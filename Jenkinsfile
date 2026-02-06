pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    environment {
        SSH_CREDENTIALS_ID = 'ssh-deploy-key'

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
                    -d text="✅ *DEPLOY SUCCESS*\n\n• Job: $JOB_NAME\n• Build: #$BUILD_NUMBER\n• Branch: main\n• Server: $DEPLOY_HOST"
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
                    -d text="❌ *DEPLOY FAILED*\n\n• Job: $JOB_NAME\n• Build: #$BUILD_NUMBER\n• Branch: main\n• URL: $BUILD_URL"
                '''
            }
        }

        always {
            cleanWs()
        }
    }
}
