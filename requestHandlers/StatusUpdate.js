const RequestHandler = require('../structures/RequestHandler')

class StatusUpdate extends RequestHandler {
  get name () {
    return 'Discord'
  }

  get canHandle () {
    return ['STATUS_UPDATE']
  }

  async handle (event) {
    this.bot.statusUpdate(Object.assign({ status: 'online' }, event))
  }
}

module.exports = StatusUpdate
