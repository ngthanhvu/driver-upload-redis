pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    environment {
        // SSH key để deploy
        SSH_CREDENTIALS_ID = 'ssh-deploy-key'

        // Thông tin server
        DEPLOY_HOST = credentials('deploy-host')
        DEPLOY_USER = 'root'
        DEPLOY_PATH = '/root/ngthanhvu/drive-app'
        DEPLOY_BRANCH = 'main'
    }

    stages {
        stage('Checkout Source') {
            steps {
                checkout scm
            }
        }

        stage('Deploy to Server') {
            steps {
                withCredentials([
                    sshUserPrivateKey(
                        credentialsId: SSH_CREDENTIALS_ID,
                        keyFileVariable: 'SSH_KEY'
                    )
                ]) {
                    sh '''
                        echo "🚀 Deploying to server..."

                        ssh -i "$SSH_KEY" \
                            -o StrictHostKeyChecking=no \
                            '"$DEPLOY_USER"'@'"$DEPLOY_HOST"' << 'EOF'

                        set -e
                        echo "📂 Go to project directory"
                        cd '"$DEPLOY_PATH"'

                        echo "📥 Pull latest code"
                        git fetch --all
                        git checkout '"$DEPLOY_BRANCH"'
                        git pull origin '"$DEPLOY_BRANCH"'

                        echo "🛠 Run build script"
                        chmod +x run-build.sh
                        ./run-build.sh

                        echo "✅ Deploy done"
                        EOF
                    '''
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
