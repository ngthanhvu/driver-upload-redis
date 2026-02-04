import { createHash, createHmac } from "crypto";

type S3Config = {
    endpoint: string;
    port: number;
    useSSL: boolean;
    accessKey: string;
    secretKey: string;
    bucket: string;
    region: string;
    protocol: "http" | "https";
    hostHeader: string;
    origin: string;
};

const readConfig = (): S3Config => {
    const endpoint = process.env.MINIO_ENDPOINT || "localhost";
    const rawPort = Number(process.env.MINIO_PORT || "9000");
    const port = Number.isFinite(rawPort) ? rawPort : 9000;
    const useSSL = (process.env.MINIO_USE_SSL || "false").toLowerCase() === "true";
    const accessKey = process.env.MINIO_ACCESS_KEY || "";
    const secretKey = process.env.MINIO_SECRET_KEY || "";
    const bucket = process.env.MINIO_BUCKET || "drive-documents";
    const region = process.env.MINIO_REGION || "us-east-1";
    const protocol = useSSL ? "https" : "http";
    const useDefaultPort = (useSSL && port === 443) || (!useSSL && port === 80);
    const hostHeader = useDefaultPort ? endpoint : `${endpoint}:${port}`;
    const origin = `${protocol}://${hostHeader}`;

    return {
        endpoint,
        port,
        useSSL,
        accessKey,
        secretKey,
        bucket,
        region,
        protocol,
        hostHeader,
        origin
    };
};

type QueryParams = Record<string, string | undefined>;

type SignedRequestOptions = {
    method: "GET" | "PUT" | "HEAD" | "DELETE";
    path: string;
    body?: Buffer;
    query?: QueryParams;
    headers?: Record<string, string>;
};

class S3RequestError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = "S3RequestError";
        this.status = status;
    }
}

const encodeRfc3986 = (value: string) =>
    encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
        `%${char.charCodeAt(0).toString(16).toUpperCase()}`
    );

const canonicalUri = (path: string) => {
    const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
    return withLeadingSlash
        .split("/")
        .map((segment) => encodeRfc3986(segment))
        .join("/");
};

const canonicalQueryString = (query: QueryParams = {}) =>
    Object.entries(query)
        .filter(([, value]) => value !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value || "")}`)
        .join("&");

const sha256Hex = (content: Buffer | string) =>
    createHash("sha256").update(content).digest("hex");

const hmac = (key: Buffer | string, value: string) =>
    createHmac("sha256", key).update(value).digest();

const formatAmzDate = (now: Date) => {
    const year = String(now.getUTCFullYear());
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const day = String(now.getUTCDate()).padStart(2, "0");
    const hour = String(now.getUTCHours()).padStart(2, "0");
    const minute = String(now.getUTCMinutes()).padStart(2, "0");
    const second = String(now.getUTCSeconds()).padStart(2, "0");

    return {
        amzDate: `${year}${month}${day}T${hour}${minute}${second}Z`,
        dateStamp: `${year}${month}${day}`
    };
};

const normalizeHeaders = (headers: Record<string, string>) =>
    Object.entries(headers).reduce<Record<string, string>>((acc, [key, value]) => {
        acc[key.toLowerCase()] = value.trim().replace(/\s+/g, " ");
        return acc;
    }, {});

const signedRequest = async ({
    method,
    path,
    body,
    query,
    headers = {}
}: SignedRequestOptions) => {
    const config = readConfig();

    if (!config.accessKey || !config.secretKey) {
        throw new Error("MINIO_ACCESS_KEY and MINIO_SECRET_KEY are required.");
    }

    const payload = body || Buffer.alloc(0);
    const payloadHash = sha256Hex(payload);
    const { amzDate, dateStamp } = formatAmzDate(new Date());
    const canonicalPath = canonicalUri(path);
    const canonicalQuery = canonicalQueryString(query);
    const mergedHeaders = normalizeHeaders({
        host: config.hostHeader,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": amzDate,
        ...headers
    });

    const sortedHeaderEntries = Object.entries(mergedHeaders).sort(([left], [right]) =>
        left.localeCompare(right)
    );
    const canonicalHeaders = sortedHeaderEntries
        .map(([key, value]) => `${key}:${value}\n`)
        .join("");
    const signedHeaders = sortedHeaderEntries.map(([key]) => key).join(";");

    const canonicalRequest = [
        method,
        canonicalPath,
        canonicalQuery,
        canonicalHeaders,
        signedHeaders,
        payloadHash
    ].join("\n");

    const credentialScope = `${dateStamp}/${config.region}/s3/aws4_request`;
    const stringToSign = [
        "AWS4-HMAC-SHA256",
        amzDate,
        credentialScope,
        sha256Hex(canonicalRequest)
    ].join("\n");

    const dateKey = hmac(`AWS4${config.secretKey}`, dateStamp);
    const regionKey = hmac(dateKey, config.region);
    const serviceKey = hmac(regionKey, "s3");
    const signingKey = hmac(serviceKey, "aws4_request");
    const signature = createHmac("sha256", signingKey)
        .update(stringToSign)
        .digest("hex");

    const authorization = [
        `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${credentialScope}`,
        `SignedHeaders=${signedHeaders}`,
        `Signature=${signature}`
    ].join(", ");

    const finalQuery = canonicalQuery ? `?${canonicalQuery}` : "";
    const url = `${config.origin}${canonicalPath}${finalQuery}`;
    const requestBody = payload.length > 0 ? Uint8Array.from(payload) : undefined;
    const response = await fetch(url, {
        method,
        headers: {
            ...mergedHeaders,
            Authorization: authorization
        },
        body: requestBody
    });

    if (!response.ok) {
        const bodyText = await response.text();
        const reason = bodyText || response.statusText || "S3 request failed";
        throw new S3RequestError(reason, response.status);
    }

    return response;
};

const ensureBucket = async () => {
    const bucketPath = `/${readConfig().bucket}`;
    try {
        await signedRequest({ method: "HEAD", path: bucketPath });
    } catch (error) {
        if (error instanceof S3RequestError && error.status === 404) {
            await signedRequest({ method: "PUT", path: bucketPath });
            return;
        }
        throw error;
    }
};

const putObject = async ({
    key,
    body,
    contentType,
    metadata
}: {
    key: string;
    body: Buffer;
    contentType: string;
    metadata: Record<string, string>;
}) => {
    const bucketPath = `/${readConfig().bucket}`;
    const headers: Record<string, string> = {
        "content-type": contentType || "application/octet-stream"
    };

    for (const [name, value] of Object.entries(metadata)) {
        headers[`x-amz-meta-${name.toLowerCase()}`] = value;
    }

    await signedRequest({
        method: "PUT",
        path: `${bucketPath}/${key}`,
        body,
        headers
    });
};

const parseKeysFromListXml = (xml: string) => {
    const matches = Array.from(xml.matchAll(/<Key>([^<]+)<\/Key>/g));
    return matches.map((match) => match[1]);
};

const listObjectKeys = async () => {
    const bucketPath = `/${readConfig().bucket}`;
    const response = await signedRequest({
        method: "GET",
        path: bucketPath,
        query: {
            "list-type": "2"
        }
    });

    const xml = await response.text();
    return parseKeysFromListXml(xml);
};

const headObject = async (key: string) => {
    const bucketPath = `/${readConfig().bucket}`;
    const response = await signedRequest({
        method: "HEAD",
        path: `${bucketPath}/${key}`
    });

    const headers = Object.fromEntries(response.headers.entries());
    return { headers };
};

const getObject = async (key: string) => {
    const bucketPath = `/${readConfig().bucket}`;
    const response = await signedRequest({
        method: "GET",
        path: `${bucketPath}/${key}`
    });

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const headers = Object.fromEntries(response.headers.entries());

    return { buffer, headers };
};

const deleteObject = async (key: string) => {
    const bucketPath = `/${readConfig().bucket}`;
    await signedRequest({
        method: "DELETE",
        path: `${bucketPath}/${key}`
    });
};

export {
    S3RequestError,
    ensureBucket,
    putObject,
    listObjectKeys,
    headObject,
    getObject,
    deleteObject
};
