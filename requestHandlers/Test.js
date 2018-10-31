const RequestHandler = require('../structures/RequestHandler')

class StatusUpdate extends RequestHandler {
  get name () {
    return 'Event reload'
  }

  get canHandle () {
    return ['EVENT_RELOAD']
  }

  async handle (event) {
    this.log.info('RELOAD', 'Reloading event')
  }
}

module.exports = StatusUpdate
