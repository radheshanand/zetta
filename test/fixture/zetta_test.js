var async = require('async');
var zetta = require('../../zetta');
var MockRegistry = require('./scout_test_mocks').MockRegistry;
var MockPeerRegistry = require('./scout_test_mocks').MockPeerRegistry;

module.exports = function(opts) {
  return new ZettaTest(opts);
};

var ZettaTest = function(opts) {
  opts = opts || {};
  this.startPort = opts.startPort || Math.floor(2000 + Math.random() * 1000);
  this._nextPort = this.startPort;
  this.servers = {};
  this.RegType = opts.Registry || MockRegistry;
  this.PeerRegType = opts.PeerRegistry || MockPeerRegistry;
};

ZettaTest.prototype.registry = function(Type) {
  this.RegType = Type;
  return this;
};

ZettaTest.prototype.peerRegistry = function(Type) {
  this.PeerRegType = Type;
  return this;
};

ZettaTest.prototype.server = function(name, scouts, peers) {
  var reg = new this.RegType();
  var peerRegistry = new this.PeerRegType();
  var server = zetta({ registry: reg, peerRegistry: peerRegistry });
  server.name(name);
  server.expose('*');
  if (scouts) {
    scouts.forEach(function(Scout) {
      server.use(Scout);
    });
  }
  server._testPeers = peers || [];
  server._testPort = this._nextPort++;
  this.servers[name] = server;
  return this;
};

ZettaTest.prototype.run = function(callback) {
  var self = this;
  Object.keys(this.servers).forEach(function(key) {
    var server = self.servers[key];
    server._testPeers.forEach(function(name) {
      if (!self.servers[name]) {
        return;
      }
      server.link('http://localhost:' + self.servers[name]._testPort);
    });
  });
  
  async.each( Object.keys(this.servers), function(name, next) {
    var server = self.servers[name];
    console.log('Server [' + name + '] Started on port ' + server._testPort);
    server.listen(server._testPort, function(err) {
      if (err) {
        return err;
      }
      


      async.whilst(
        function () {
          var allQuery = {
            match: function() { return true; }
          };
          var ret = false;
          server.peerRegistry.find(allQuery, function(err, results) {
            results.forEach(function(peer) {
              if (ret || !peer.status || peer.status !== 'connected') {
                ret = true;
                return;
              }
            });
          });

          return ret;
        },
        function (callback) {
          setTimeout(callback, 1000);
        },
        next
      );
    });
  }, callback);

  return this;
};


