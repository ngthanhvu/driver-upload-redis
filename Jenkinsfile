pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    environment {
        // SSH deploy
        SSH_CREDENTIALS_ID = 'ssh-deploy-key'

        // Server info (deploy-host là Secret Text)
        DEPLOY_HOST   = credentials('deploy-host')
        DEPLOY_USER   = 'root'
        DEPLOY_PATH   = '/root/ngthanhvu/drive-app'
        DEPLOY_BRANCH = 'main'
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Collect Build Info') {
            steps {
                script {
                    env.GIT_COMMIT_SHORT = sh(
                        script: 'git rev-parse --short HEAD',
                        returnStdout: true
                    ).trim()

                    env.GIT_AUTHOR = sh(
                        script: "git log -1 --pretty=format:'%an'",
                        returnStdout: true
                    ).trim()

                    env.GIT_MESSAGE = sh(
                        script: "git log -1 --pretty=format:'%s'",
                        returnStdout: true
                    ).trim()

                    env.BUILD_TIME = sh(
                        script: "date '+%Y-%m-%d %H:%M:%S'",
                        returnStdout: true
                    ).trim()
                }
            }
        }

        stage('Deploy Server') {
            steps {
                withCredentials([
                    sshUserPrivateKey(
                        credentialsId: SSH_CREDENTIALS_ID,
                        keyFileVariable: 'SSH_KEY'
                    )
                ]) {
                    sh """
                        echo '🚀 Deploying to server...'

                        ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no ${DEPLOY_USER}@${DEPLOY_HOST} '
                            set -e
                            cd ${DEPLOY_PATH}
                            git fetch --all
                            git checkout ${DEPLOY_BRANCH}
                            git pull origin ${DEPLOY_BRANCH}
                            chmod +x run-build.sh
                            ./run-build.sh
                        '
                    """
                }
            }
        }
    }

    post {

        success {
    withCredentials([
        string(credentialsId: 'telegram-bot-token', variable: 'TG_TOKEN'),
        string(credentialsId: 'telegram-chat-id', variable: 'TG_CHAT_ID')
    ]) {
        sh '''
            curl -s -X POST https://api.telegram.org/bot$TG_TOKEN/sendMessage \
              -d chat_id=$TG_CHAT_ID \
              -d parse_mode=Markdown \
              -d text="✅ *DEPLOY SUCCESS*

📦 *Project*: $JOB_NAME
🔢 *Build*: #$BUILD_NUMBER
🌿 *Branch*: $DEPLOY_BRANCH
🖥 *Server*: $DEPLOY_HOST

🔑 *Commit*: $GIT_COMMIT_SHORT
👤 *Author*: $GIT_AUTHOR
📝 *Message*: $GIT_MESSAGE

⏱ *Time*: $BUILD_TIME
"
        '''
    }
}


        failure {
    withCredentials([
        string(credentialsId: 'telegram-bot-token', variable: 'TG_TOKEN'),
        string(credentialsId: 'telegram-chat-id', variable: 'TG_CHAT_ID')
    ]) {
        sh '''
            curl -s -X POST https://api.telegram.org/bot$TG_TOKEN/sendMessage \
              -d chat_id=$TG_CHAT_ID \
              -d parse_mode=Markdown \
              -d text="❌ *DEPLOY FAILED*

📦 *Project*: $JOB_NAME
🔢 *Build*: #$BUILD_NUMBER
🌿 *Branch*: $DEPLOY_BRANCH
🖥 *Server*: $DEPLOY_HOST

🔑 *Commit*: $GIT_COMMIT_SHORT
👤 *Author*: $GIT_AUTHOR
📝 *Message*: $GIT_MESSAGE

🔗 *Jenkins Log*:
$BUILD_URL
"
        '''
    }
}


        always {
            cleanWs()
        }
    }
}
