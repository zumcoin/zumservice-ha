// Copyright (c) 2019,  The ZumCoin Developers
//
// Please see the included LICENSE file for more information.

'use strict'

const SocketIo = require('socket.io')
const sha256 = require('sha256')
const inherits = require('util').inherits
const EventEmitter = require('events').EventEmitter

var WebSocket = function (opts) {
  opts = opts || {}
  if (!(this instanceof WebSocket)) return new WebSocket(opts)
  var that = this
  this.password = opts.password || false
  this.port = opts.port || 17071

  if (this.password) {
    this.password = sha256(this.password)
  }
  this.permittedClients = {}

  this.io = SocketIo.listen(this.port, {
    serveClient: true
  })

  this.io.on('connection', (socket) => {
    socket.on('disconnect', () => {
      if (that.permittedClients[socket.id]) {
        delete that.permittedClients[socket.id]
      }
      that.emit('disconnect', socket)
    })

    socket.on('challenge', (password) => {
      if (password === this.password) {
        this.permittedClients[socket.id] = socket
        that.emit('auth.success', socket)
        socket.emit('auth', true)
      } else {
        that.emit('auth.failure', socket)
        socket.emit('auth', false)
        socket.disconnect(true)
      }
    })

    socket.on('error', (err) => {
      that.emit('error', err)
    })

    socket.emit('challenge', true)
    that.emit('connection', socket)

    setTimeout(() => {
      if (!this.permittedClients[socket.id]) {
        socket.disconnect(true)
      }
    }, 10000)
  })

  this.io.on('error', (err) => {
    that.emit('error', err)
  })

  setTimeout(() => {
    this.emit('ready')
  }, 500)
}
inherits(WebSocket, EventEmitter)

WebSocket.prototype.broadcast = function (opts) {
  opts = opts || {}
  opts.event = opts.event || false
  opts.data = opts.data || {}

  if (!opts.event) return false

  for (var key in this.permittedClients) {
    var socket = this.permittedClients[key]
    try {
      socket.emit(opts.event, opts.data)
    } catch (err) {
      this.emit('error', err)
    }
  }
  return true
}

WebSocket.prototype.send = function (opts) {
  opts = opts || {}
  opts.socket = opts.socket || false
  opts.event = opts.event || false
  opts.data = opts.data || {}

  if (!opts.socket || !opts.event) return false

  try {
    opts.socket.emit(opts.event, opts.data)
  } catch (err) {
    this.emit('error', err)
    return false
  }

  return true
}

module.exports = WebSocket
