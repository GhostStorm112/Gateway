const EventHandler = require('../structures/EventHandler')
class DisconnectedHandler extends EventHandler {
  get name () {
    return 'Disconnected'
  }

  get canHandle () {
    return ['DISCONNECTED']
  }

  async handle (event) {
    this.log.info('Gateway', 'All shards succesfully disconnected')
  }
}

module.exports = DisconnectedHandler
