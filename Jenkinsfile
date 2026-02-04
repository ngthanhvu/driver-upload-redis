pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  parameters {
    booleanParam(
      name: 'DEPLOY',
      defaultValue: true,
      description: 'Deploy service with docker compose after build'
    )
  }

  environment {
    COMPOSE_FILE = 'docker-compose.prod.yml'
    COMPOSE_PROJECT_NAME = 'drive-upload-redis'
    DOCKER_BUILDKIT = '1'
    COMPOSE_DOCKER_CLI_BUILD = '1'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Install & Build') {
      parallel {
        stage('Backend') {
          steps {
            dir('backend') {
              sh '''
                set -eux
                npm ci
                npm run build
              '''
            }
          }
        }
        stage('Frontend') {
          steps {
            dir('frontend') {
              sh '''
                set -eux
                npm ci
                npm run build
              '''
            }
          }
        }
      }
    }

    stage('Deploy') {
      when {
        expression { return params.DEPLOY }
      }
      steps {
        sh '''
          set -eux
          docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" up -d --build --remove-orphans
          docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" ps
        '''
      }
    }
  }

  post {
    failure {
      sh '''
        set +e
        docker compose -p "$COMPOSE_PROJECT_NAME" -f "$COMPOSE_FILE" logs --tail=150
      '''
    }
  }
}
