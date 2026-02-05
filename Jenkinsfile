pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    environment {
        DOCKER_HUB_CREDENTIALS_ID = 'docker'
        SSH_CREDENTIALS_ID = credentials('ssh-deploy-key')

        DOCKER_NAMESPACE = 'ngthanhvu'
        BACKEND_IMAGE_NAME = 'drive-backend'
        FRONTEND_IMAGE_NAME = 'drive-frontend'

        // Chi host de trong Credentials neu ban muon an thong tin server
        DEPLOY_HOST = credentials('deploy-host')
        DEPLOY_USER = credentials('deploy-user')
        DEPLOY_PATH = '/root/ngthanhvu/drive-app'
        DEPLOY_BRANCH = 'main'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Init Build Metadata') {
            steps {
                script {
                    def shortCommit = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
                    def ts = sh(script: 'date +%Y%m%d%H%M%S', returnStdout: true).trim()
                    env.IMAGE_TAG = "${ts}-${shortCommit}"
                    env.BACKEND_IMAGE = "${DOCKER_NAMESPACE}/${BACKEND_IMAGE_NAME}"
                    env.FRONTEND_IMAGE = "${DOCKER_NAMESPACE}/${FRONTEND_IMAGE_NAME}"
                }
            }
        }

        stage('Docker Login') {
            steps {
                withCredentials([usernamePassword(credentialsId: env.DOCKER_HUB_CREDENTIALS_ID, passwordVariable: 'DOCKER_HUB_PASSWORD', usernameVariable: 'DOCKER_HUB_USERNAME')]) {
                    sh 'echo "$DOCKER_HUB_PASSWORD" | docker login -u "$DOCKER_HUB_USERNAME" --password-stdin'
                }
            }
        }

        stage('Build Images') {
            steps {
                sh """
                    docker build -f backend/Dockerfile.prod \
                      -t ${BACKEND_IMAGE}:${IMAGE_TAG} \
                      -t ${BACKEND_IMAGE}:latest \
                      backend

                    docker build -f frontend/Dockerfile.prod \
                      -t ${FRONTEND_IMAGE}:${IMAGE_TAG} \
                      -t ${FRONTEND_IMAGE}:latest \
                      frontend
                """
            }
        }

        stage('Push Images') {
            steps {
                sh """
                    docker push ${BACKEND_IMAGE}:${IMAGE_TAG}
                    docker push ${BACKEND_IMAGE}:latest
                    docker push ${FRONTEND_IMAGE}:${IMAGE_TAG}
                    docker push ${FRONTEND_IMAGE}:latest
                """
            }
        }

        stage('Deploy Server') {
            steps {
                withCredentials([sshUserPrivateKey(credentialsId: env.SSH_CREDENTIALS_ID, keyFileVariable: 'SSH_KEY')]) {
                    sh """
                        ssh -i \"$SSH_KEY\" -o StrictHostKeyChecking=no ${DEPLOY_USER}@${DEPLOY_HOST} '
                          set -e
                          cd ${DEPLOY_PATH}
                          git fetch --all
                          git checkout ${DEPLOY_BRANCH}
                          git pull origin ${DEPLOY_BRANCH}
                          cat > docker-compose.override.yml <<EOF
services:
  backend:
    image: ${BACKEND_IMAGE}:${IMAGE_TAG}
  frontend:
    image: ${FRONTEND_IMAGE}:${IMAGE_TAG}
EOF
                          docker compose -f docker-compose.prod.yml -f docker-compose.override.yml pull backend frontend
                          docker compose -f docker-compose.prod.yml -f docker-compose.override.yml up -d --no-build --remove-orphans
                          docker image prune -f
                        '
                    """
                }
            }
        }
    }

    post {
        success {
            echo "Build and deploy success: ${BACKEND_IMAGE}:${IMAGE_TAG}, ${FRONTEND_IMAGE}:${IMAGE_TAG}"
        }

        failure {
            echo "Build failed: ${env.BUILD_URL}"
        }

        always {
            sh "docker rmi -f ${BACKEND_IMAGE}:${IMAGE_TAG} ${BACKEND_IMAGE}:latest || true"
            sh "docker rmi -f ${FRONTEND_IMAGE}:${IMAGE_TAG} ${FRONTEND_IMAGE}:latest || true"
            sh 'docker image prune -f || true'
            sh 'docker logout || true'
            cleanWs()
        }
    }
}
