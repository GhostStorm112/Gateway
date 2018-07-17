const RequestHandler = require('../structures/RequestHandler')

class StatusUpdate extends RequestHandler {
  get name () {
    return 'Discord'
  }

  get canHandle () {
    return ['TEST']
  }

  async handle (event) {
  }
}

module.exports = StatusUpdate
