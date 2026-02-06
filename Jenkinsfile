pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    environment {
        // SSH key deploy
        SSH_CREDENTIALS_ID = 'ssh-deploy-key'

        // Host để trong Credentials (Secret Text)
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
            echo '🎉 Deploy SUCCESS'
        }

        failure {
            echo "❌ Deploy FAILED: ${env.BUILD_URL}"
        }

        always {
            cleanWs()
        }
    }
}
