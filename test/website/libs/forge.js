//forge
/* modifs from forge (tls.js):
  - remove server key exchange message (2 changes)
  - remove version check (2 changes)
  - ignore unexpected messages (1 change)
  - change fatal to true for handshake already in progress
  - change test in handle server hello when session id is not set
  - clear .input.data in process (memory leak)
*/
const crypto = require('crypto');
const forge = {};

global.forge_buffers = true;

const Rand = function (length) {
  return crypto.randomBytes(length);
};

//util.js (forge)

/**
 * Utility functions for web applications.
 *
 * @author Dave Longley
 *
 * Copyright (c) 2010-2012 Digital Bazaar, Inc.
 */

(function () {
  /*function c(q){*/
  var q = forge;
  var l = q.util = q.util || {};
  if (typeof process === "undefined" || !process.nextTick) {
    if (typeof setImmediate === "function") {
      l.setImmediate = setImmediate;
      l.nextTick = function (s) {
        return setImmediate(s)
      }
    } else {
      l.setImmediate = function (s) {
        setTimeout(s, 0)
      };
      l.nextTick = l.setImmediate
    }
  } else {
    l.nextTick = process.nextTick;
    if (typeof setImmediate === "function") {
      l.setImmediate = setImmediate
    } else {
      l.setImmediate = l.nextTick
    }
  }
  l.isArray = Array.isArray || function (s) {
    return Object.prototype.toString.call(s) === "[object Array]"
  };
  l.ByteBuffer = function (s) {
    this.data = s || "";
    this.read = 0
  };
  l.ByteBuffer.prototype.length = function () {
    return this.data.length - this.read
  };
  l.ByteBuffer.prototype.isEmpty = function () {
    return this.length() <= 0
  };
  l.ByteBuffer.prototype.putByte = function (s) {
    this.data += String.fromCharCode(s);
    return this
  };
  l.ByteBuffer.prototype.fillWithByte = function (s, u) {
    s = String.fromCharCode(s);
    var t = this.data;
    while (u > 0) {
      if (u & 1) {
        t += s
      }
      u >>>= 1;
      if (u > 0) {
        s += s
      }
    }
    this.data = t;
    return this
  };
  l.ByteBuffer.prototype.putBytes = function (s) {
    this.data += s;
    return this
  };
  l.ByteBuffer.prototype.putString = function (s) {
    this.data += l.encodeUtf8(s);
    return this
  };
  l.ByteBuffer.prototype.putInt16 = function (s) {
    this.data += String.fromCharCode(s >> 8 & 255) + String.fromCharCode(s & 255);
    return this
  };
  l.ByteBuffer.prototype.putInt24 = function (s) {
    this.data += String.fromCharCode(s >> 16 & 255) + String.fromCharCode(s >> 8 & 255) + String.fromCharCode(s & 255);
    return this
  };
  l.ByteBuffer.prototype.putInt32 = function (s) {
    this.data += String.fromCharCode(s >> 24 & 255) + String.fromCharCode(s >> 16 & 255) + String.fromCharCode(s >> 8 & 255) + String.fromCharCode(s & 255);
    return this
  };
  l.ByteBuffer.prototype.putInt16Le = function (s) {
    this.data += String.fromCharCode(s & 255) + String.fromCharCode(s >> 8 & 255);
    return this
  };
  l.ByteBuffer.prototype.putInt24Le = function (s) {
    this.data += String.fromCharCode(s & 255) + String.fromCharCode(s >> 8 & 255) + String.fromCharCode(s >> 16 & 255);
    return this
  };
  l.ByteBuffer.prototype.putInt32Le = function (s) {
    this.data += String.fromCharCode(s & 255) + String.fromCharCode(s >> 8 & 255) + String.fromCharCode(s >> 16 & 255) + String.fromCharCode(s >> 24 & 255);
    return this
  };
  l.ByteBuffer.prototype.putInt = function (s, t) {
    do {
      t -= 8;
      this.data += String.fromCharCode((s >> t) & 255)
    } while (t > 0);
    return this
  };
  l.ByteBuffer.prototype.putSignedInt = function (s, t) {
    if (s < 0) {
      s += 2 << (t - 1)
    }
    return this.putInt(s, t)
  };
  l.ByteBuffer.prototype.putBuffer = function (s) {
    this.data += s.getBytes();
    return this
  };
  l.ByteBuffer.prototype.getByte = function () {
    return this.data.charCodeAt(this.read++)
  };
  l.ByteBuffer.prototype.getInt16 = function () {
    var s = (this.data.charCodeAt(this.read) << 8 ^ this.data.charCodeAt(this.read + 1));
    this.read += 2;
    return s
  };
  l.ByteBuffer.prototype.getInt24 = function () {
    var s = (this.data.charCodeAt(this.read) << 16 ^ this.data.charCodeAt(this.read + 1) << 8 ^ this.data.charCodeAt(this.read + 2));
    this.read += 3;
    return s
  };
  l.ByteBuffer.prototype.getInt32 = function () {
    var s = (this.data.charCodeAt(this.read) << 24 ^ this.data.charCodeAt(this.read + 1) << 16 ^ this.data.charCodeAt(this.read + 2) << 8 ^ this.data.charCodeAt(this.read + 3));
    this.read += 4;
    return s
  };
  l.ByteBuffer.prototype.getInt16Le = function () {
    var s = (this.data.charCodeAt(this.read) ^ this.data.charCodeAt(this.read + 1) << 8);
    this.read += 2;
    return s
  };
  l.ByteBuffer.prototype.getInt24Le = function () {
    var s = (this.data.charCodeAt(this.read) ^ this.data.charCodeAt(this.read + 1) << 8 ^ this.data.charCodeAt(this.read + 2) << 16);
    this.read += 3;
    return s
  };
  l.ByteBuffer.prototype.getInt32Le = function () {
    var s = (this.data.charCodeAt(this.read) ^ this.data.charCodeAt(this.read + 1) << 8 ^ this.data.charCodeAt(this.read + 2) << 16 ^ this.data.charCodeAt(this.read + 3) << 24);
    this.read += 4;
    return s
  };
  l.ByteBuffer.prototype.getInt = function (t) {
    var s = 0;
    do {
      s = (s << 8) + this.data.charCodeAt(this.read++);
      t -= 8
    } while (t > 0);
    return s
  };
  l.ByteBuffer.prototype.getSignedInt = function (u) {
    var t = this.getInt(u);
    var s = 2 << (u - 2);
    if (t >= s) {
      t -= s << 1
    }
    return t
  };
  l.ByteBuffer.prototype.getBytes = function (s) {
    var t;
    if (s) {
      s = Math.min(this.length(), s);
      t = this.data.slice(this.read, this.read + s);
      this.read += s
    } else {
      if (s === 0) {
        t = ""
      } else {
        t = (this.read === 0) ? this.data : this.data.slice(this.read);
        this.clear()
      }
    }
    return t
  };
  l.ByteBuffer.prototype.bytes = function (s) {
    return (typeof (s) === "undefined" ? this.data.slice(this.read) : this.data.slice(this.read, this.read + s))
  };
  l.ByteBuffer.prototype.at = function (s) {
    return this.data.charCodeAt(this.read + s)
  };
  l.ByteBuffer.prototype.setAt = function (t, s) {
    this.data = this.data.substr(0, this.read + t) + String.fromCharCode(s) + this.data.substr(this.read + t + 1);
    return this
  };
  l.ByteBuffer.prototype.last = function () {
    return this.data.charCodeAt(this.data.length - 1)
  };
  l.ByteBuffer.prototype.copy = function () {
    var s = l.createBuffer(this.data);
    s.read = this.read;
    return s
  };
  l.ByteBuffer.prototype.compact = function () {
    if (this.read > 0) {
      this.data = this.data.slice(this.read);
      this.read = 0
    }
    return this
  };
  l.ByteBuffer.prototype.clear = function () {
    this.data = "";
    this.read = 0;
    return this
  };
  l.ByteBuffer.prototype.truncate = function (t) {
    var s = Math.max(0, this.length() - t);
    this.data = this.data.substr(this.read, s);
    this.read = 0;
    return this
  };
  l.ByteBuffer.prototype.toHex = function () {
    var u = "";
    for (var t = this.read; t < this.data.length; ++t) {
      var s = this.data.charCodeAt(t);
      if (s < 16) {
        u += "0"
      }
      u += s.toString(16)
    }
    return u
  };
  l.ByteBuffer.prototype.toString = function () {
    return l.decodeUtf8(this.bytes())
  };
  l.createBuffer = function (s, t) {
    t = t || "raw";
    if (s !== undefined && t === "utf8") {
      s = l.encodeUtf8(s)
    }
    return new l.ByteBuffer(s)
  };
  l.fillString = function (v, u) {
    var t = "";
    while (u > 0) {
      if (u & 1) {
        t += v
      }
      u >>>= 1;
      if (u > 0) {
        v += v
      }
    }
    return t
  };
  l.xorBytes = function (y, v, A) {
    var u = "";
    var s = "";
    var x = "";
    var w = 0;
    var z = 0;
    for (; A > 0; --A, ++w) {
      s = y.charCodeAt(w) ^ v.charCodeAt(w);
      if (z >= 10) {
        u += x;
        x = "";
        z = 0
      }
      x += String.fromCharCode(s);
      ++z
    }
    u += x;
    return u
  };
  l.hexToBytes = function (t) {
    var u = "";
    var s = 0;
    if (t.length & 1 == 1) {
      s = 1;
      u += String.fromCharCode(parseInt(t[0], 16))
    }
    for (; s < t.length; s += 2) {
      u += String.fromCharCode(parseInt(t.substr(s, 2), 16))
    }
    return u
  };
  l.bytesToHex = function (s) {
    return l.createBuffer(s).toHex()
  };
  l.int32ToBytes = function (s) {
    return (String.fromCharCode(s >> 24 & 255) + String.fromCharCode(s >> 16 & 255) + String.fromCharCode(s >> 8 & 255) + String.fromCharCode(s & 255))
  };
  var g = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  var r = [62, -1, -1, -1, 63, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, -1, -1, -1, 64, -1, -1, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, -1, -1, -1, -1, -1, -1, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51];
  l.encode64 = function (v, z) {
    var s = "";
    var u = "";
    var y, w, t;
    var x = 0;
    while (x < v.length) {
      y = v.charCodeAt(x++);
      w = v.charCodeAt(x++);
      t = v.charCodeAt(x++);
      s += g.charAt(y >> 2);
      s += g.charAt(((y & 3) << 4) | (w >> 4));
      if (isNaN(w)) {
        s += "=="
      } else {
        s += g.charAt(((w & 15) << 2) | (t >> 6));
        s += isNaN(t) ? "=" : g.charAt(t & 63)
      }
      if (z && s.length > z) {
        u += s.substr(0, z) + "\r\n";
        s = s.substr(z)
      }
    }
    u += s;
    return u
  };
  l.decode64 = function (t) {
    t = t.replace(/[^A-Za-z0-9\+\/\=]/g, "");
    var s = "";
    var y, x, w, v;
    var u = 0;
    while (u < t.length) {
      y = r[t.charCodeAt(u++) - 43];
      x = r[t.charCodeAt(u++) - 43];
      w = r[t.charCodeAt(u++) - 43];
      v = r[t.charCodeAt(u++) - 43];
      s += String.fromCharCode((y << 2) | (x >> 4));
      if (w !== 64) {
        s += String.fromCharCode(((x & 15) << 4) | (w >> 2));
        if (v !== 64) {
          s += String.fromCharCode(((w & 3) << 6) | v)
        }
      }
    }
    return s
  };
  l.encodeUtf8 = function (s) {
    return unescape(encodeURIComponent(s))
  };
  l.decodeUtf8 = function (s) {
    return decodeURIComponent(escape(s))
  };
  l.deflate = function (v, t, u) {
    t = l.decode64(v.deflate(l.encode64(t)).rval);
    if (u) {
      var w = 2;
      var s = t.charCodeAt(1);
      if (s & 32) {
        w = 6
      }
      t = t.substring(w, t.length - 4)
    }
    return t
  };
  l.inflate = function (u, s, t) {
    var v = u.inflate(l.encode64(s)).rval;
    return (v === null) ? null : l.decode64(v)
  };
  var i = function (s, v, u) {
    if (!s) {
      throw {
        message: "WebStorage not available."
      }
    }
    var t;
    if (u === null) {
      t = s.removeItem(v)
    } else {
      u = l.encode64(JSON.stringify(u));
      t = s.setItem(v, u)
    }
    if (typeof (t) !== "undefined" && t.rval !== true) {
      throw t.error
    }
  };
  var k = function (s, u) {
    if (!s) {
      throw {
        message: "WebStorage not available."
      }
    }
    var t = s.getItem(u);
    if (s.init) {
      if (t.rval === null) {
        if (t.error) {
          throw t.error
        }
        t = null
      } else {
        t = t.rval
      }
    }
    if (t !== null) {
      t = JSON.parse(l.decode64(t))
    }
    return t
  };
  var p = function (t, w, s, u) {
    var v = k(t, w);
    if (v === null) {
      v = {}
    }
    v[s] = u;
    i(t, w, v)
  };
  var h = function (t, v, s) {
    var u = k(t, v);
    if (u !== null) {
      u = (s in u) ? u[s] : null
    }
    return u
  };
  var j = function (t, x, s) {
    var v = k(t, x);
    if (v !== null && s in v) {
      delete v[s];
      var u = true;
      for (var w in v) {
        u = false;
        break
      }
      if (u) {
        v = null
      }
      i(t, x, v)
    }
  };
  var n = function (s, t) {
    i(s, t, null)
  };
  var m = function (t, x, z) {
    var v = null;
    if (typeof (z) === "undefined") {
      z = ["web", "flash"]
    }
    var y;
    var u = false;
    var s = null;
    for (var A in z) {
      y = z[A];
      try {
        if (y === "flash" || y === "both") {
          if (x[0] === null) {
            throw {
              message: "Flash local storage not available."
            }
          } else {
            v = t.apply(this, x);
            u = (y === "flash")
          }
        }
        if (y === "web" || y === "both") {
          x[0] = localStorage;
          v = t.apply(this, x);
          u = true
        }
      } catch (w) {
        s = w
      }
      if (u) {
        break
      }
    }
    if (!u) {
      throw s
    }
    return v
  };
  l.setItem = function (u, w, t, v, s) {
    m(p, arguments, s)
  };
  l.getItem = function (u, v, t, s) {
    return m(h, arguments, s)
  };
  l.removeItem = function (u, v, t, s) {
    m(j, arguments, s)
  };
  l.clearItems = function (t, u, s) {
    m(n, arguments, s)
  };
  l.parseUrl = function (v) {
    var u = /^(https?):\/\/([^:&^\/]*):?(\d*)(.*)$/g;
    u.lastIndex = 0;
    var s = u.exec(v);
    var t = (s === null) ? null : {
      full: v,
      scheme: s[1],
      host: s[2],
      port: s[3],
      path: s[4]
    };
    if (t) {
      t.fullHost = t.host;
      if (t.port) {
        if (t.port !== 80 && t.scheme === "http") {
          t.fullHost += ":" + t.port
        } else {
          if (t.port !== 443 && t.scheme === "https") {
            t.fullHost += ":" + t.port
          }
        }
      } else {
        if (t.scheme === "http") {
          t.port = 80
        } else {
          if (t.scheme === "https") {
            t.port = 443
          }
        }
      }
      t.full = t.scheme + "://" + t.fullHost
    }
    return t
  };
  var o = null;
  l.getQueryVariables = function (s) {
    var u = function (y) {
      var z = {};
      var x = y.split("&");
      for (var w = 0; w < x.length; w++) {
        var B = x[w].indexOf("=");
        var v;
        var A;
        if (B > 0) {
          v = x[w].substring(0, B);
          A = x[w].substring(B + 1)
        } else {
          v = x[w];
          A = null
        }
        if (!(v in z)) {
          z[v] = []
        }
        if (!(v in Object.prototype) && A !== null) {
          z[v].push(unescape(A))
        }
      }
      return z
    };
    var t;
    if (typeof (s) === "undefined") {
      if (o === null) {
        if (typeof (window) === "undefined") {
          o = {}
        } else {
          o = u(window.location.search.substring(1))
        }
      }
      t = o
    } else {
      t = u(s)
    }
    return t
  };
  l.parseFragment = function (u) {
    var t = u;
    var s = "";
    var x = u.indexOf("?");
    if (x > 0) {
      t = u.substring(0, x);
      s = u.substring(x + 1)
    }
    var w = t.split("/");
    if (w.length > 0 && w[0] === "") {
      w.shift()
    }
    var v = (s === "") ? {} : l.getQueryVariables(s);
    return {
      pathString: t,
      queryString: s,
      path: w,
      query: v
    }
  };
  l.makeRequest = function (t) {
    var u = l.parseFragment(t);
    var s = {
      path: u.pathString,
      query: u.queryString,
      getPath: function (v) {
        return (typeof (v) === "undefined") ? u.path : u.path[v]
      },
      getQuery: function (v, w) {
        var x;
        if (typeof (v) === "undefined") {
          x = u.query
        } else {
          x = u.query[v];
          if (x && typeof (w) !== "undefined") {
            x = x[w]
          }
        }
        return x
      },
      getQueryLast: function (w, v) {
        var y;
        var x = s.getQuery(w);
        if (x) {
          y = x[x.length - 1]
        } else {
          y = v
        }
        return y
      }
    };
    return s
  };
  l.makeLink = function (v, u, t) {
    v = jQuery.isArray(v) ? v.join("/") : v;
    var s = jQuery.param(u || {});
    t = t || "";
    return v + ((s.length > 0) ? ("?" + s) : "") + ((t.length > 0) ? ("#" + t) : "")
  };
  l.setPath = function (u, x, y) {
    if (typeof (u) === "object" && u !== null) {
      var v = 0;
      var t = x.length;
      while (v < t) {
        var w = x[v++];
        if (v == t) {
          u[w] = y
        } else {
          var s = (w in u);
          if (!s || (s && typeof (u[w]) !== "object") || (s && u[w] === null)) {
            u[w] = {}
          }
          u = u[w]
        }
      }
    }
  };
  l.getPath = function (v, y, u) {
    var w = 0;
    var t = y.length;
    var s = true;
    while (s && w < t && typeof (v) === "object" && v !== null) {
      var x = y[w++];
      s = x in v;
      if (s) {
        v = v[x]
      }
    }
    return (s ? v : u)
  };
  l.deletePath = function (t, w) {
    if (typeof (t) === "object" && t !== null) {
      var u = 0;
      var s = w.length;
      while (u < s) {
        var v = w[u++];
        if (u == s) {
          delete t[v]
        } else {
          if (!(v in t) || (typeof (t[v]) !== "object") || (t[v] === null)) {
            break
          }
          t = t[v]
        }
      }
    }
  };
  l.isEmpty = function (s) {
    for (var t in s) {
      if (s.hasOwnProperty(t)) {
        return false
      }
    }
    return true
  };
  l.format = function (z) {
    var v = /%./g;
    var u;
    var t;
    var s = 0;
    var y = [];
    var x = 0;
    while ((u = v.exec(z))) {
      t = z.substring(x, v.lastIndex - 2);
      if (t.length > 0) {
        y.push(t)
      }
      x = v.lastIndex;
      var w = u[0][1];
      switch (w) {
        case "s":
        case "o":
          if (s < arguments.length) {
            y.push(arguments[s++ + 1])
          } else {
            y.push("<?>")
          }
          break;
        case "%":
          y.push("%");
          break;
        default:
          y.push("<%" + w + "?>")
      }
    }
    y.push(z.substring(x));
    return y.join("")
  };
  l.formatNumber = function (x, v, C, w) {
    var u = x,
      B = isNaN(v = Math.abs(v)) ? 2 : v;
    var A = C === undefined ? "," : C;
    var D = w === undefined ? "." : w,
      E = u < 0 ? "-" : "";
    var z = parseInt((u = Math.abs(+u || 0).toFixed(B)), 10) + "";
    var y = (z.length > 3) ? z.length % 3 : 0;
    return E + (y ? z.substr(0, y) + D : "") + z.substr(y).replace(/(\d{3})(?=\d)/g, "$1" + D) + (B ? A + Math.abs(u - z).toFixed(B).slice(2) : "")
  };
  l.formatSize = function (s) {
    if (s >= 1073741824) {
      s = l.formatNumber(s / 1073741824, 2, ".", "") + " GiB"
    } else {
      if (s >= 1048576) {
        s = l.formatNumber(s / 1048576, 2, ".", "") + " MiB"
      } else {
        if (s >= 1024) {
          s = l.formatNumber(s / 1024, 0) + " KiB"
        } else {
          s = l.formatNumber(s, 0) + " bytes"
        }
      }
    }
    return s
  };
  l.bytesFromIP = function (s) {
    if (s.indexOf(".") !== -1) {
      return l.bytesFromIPv4(s)
    }
    if (s.indexOf(":") !== -1) {
      return l.bytesFromIPv6(s)
    }
    return null
  };
  l.bytesFromIPv4 = function (v) {
    v = v.split(".");
    if (v.length !== 4) {
      return null
    }
    var s = l.createBuffer();
    for (var u = 0; u < v.length; ++u) {
      var t = parseInt(v[u], 10);
      if (isNaN(t)) {
        return null
      }
      s.putByte(t)
    }
    return s.getBytes()
  };
  l.bytesFromIPv6 = function (x) {
    var w = 0;
    x = x.split(":").filter(function (y) {
      if (y.length === 0) {
        ++w
      }
      return true
    });
    var u = (8 - x.length + w) * 2;
    var s = l.createBuffer();
    for (var v = 0; v < 8; ++v) {
      if (!x[v] || x[v].length === 0) {
        s.fillWithByte(0, u);
        u = 0;
        continue
      }
      var t = l.hexToBytes(x[v]);
      if (t.length < 2) {
        s.putByte(0)
      }
      s.putBytes(t)
    }
    return s.getBytes()
  };
  l.bytesToIP = function (s) {
    if (s.length === 4) {
      return l.bytesToIPv4(s)
    }
    if (s.length === 16) {
      return l.bytesToIPv6(s)
    }
    return null
  };
  l.bytesToIPv4 = function (s) {
    if (s.length !== 4) {
      return null
    }
    var u = [];
    for (var t = 0; t < s.length; ++t) {
      u.push(s.charCodeAt(t))
    }
    return u.join(".")
  };
  l.bytesToIPv6 = function (A) {
    if (A.length !== 16) {
      return null
    }
    var u = [];
    var z = [];
    var v = 0;
    for (var t = 0; t < A.length; t += 2) {
      var s = l.bytesToHex(A[t] + A[t + 1]);
      while (s[0] === "0" && s !== "0") {
        s = s.substr(1)
      }
      if (s === "0") {
        var y = z[z.length - 1];
        var w = u.length;
        if (!y || w !== y.end + 1) {
          z.push({
            start: w,
            end: w
          })
        } else {
          y.end = w;
          if ((y.end - y.start) > (z[v].end - z[v].start)) {
            v = z.length - 1
          }
        }
      }
      u.push(s)
    }
    if (z.length > 0) {
      var x = z[v];
      if (x.end - x.start > 0) {
        u.splice(x.start, x.end - x.start + 1, "");
        if (x.start === 0) {
          u.unshift("")
        }
        if (x.end === 7) {
          u.push("")
        }
      }
    }
    return u.join(":")
  } /*}var b="util";if(typeof define!=="function"){if(typeof module==="object"&&module.exports){var d=true;define=function(h,g){g(require,module)}}else{if(typeof forge==="undefined"){forge={}}return c(forge)}}var f;var a=function(g,h){h.exports=function(k){var l=f.map(function(i){return g(i)}).concat(c);k=k||{};k.defined=k.defined||{};if(k.defined[b]){return k[b]}k.defined[b]=true;for(var j=0;j<l.length;++j){l[j](k)}return k[b]}};var e=define;define=function(h,g){f=(typeof h==="string")?g.slice(2):h.slice(2);if(d){delete define;return e.apply(null,Array.prototype.slice.call(arguments,0))}define=e;return define.apply(null,Array.prototype.slice.call(arguments,0))};define(["require","module"],function(){a.apply(null,Array.prototype.slice.call(arguments,0))})*/
})();

//sha1.js (forge)

/**
 * Secure Hash Algorithm with 160-bit digest (SHA-1) implementation.
 *
 * This implementation is currently limited to message lengths (in bytes) that
 * are up to 32-bits in size.
 *
 * @author Dave Longley
 *
 * Copyright (c) 2010-2012 Digital Bazaar, Inc.
 */
(function () {
  var e = forge.sha1 = forge.sha1 || {};
  forge.md = forge.md || {};
  forge.md.algorithms = forge.md.algorithms || {};
  forge.md.sha1 = forge.md.algorithms.sha1 = e;
  var c = null;
  var b = false;
  var d = function () {
    c = String.fromCharCode(128);
    c += forge.util.fillString(String.fromCharCode(0), 64);
    b = true
  };
  var a = function (r, p, u) {
    var q, o, n, m, l, k, j, g;
    var h = u.length();
    while (h >= 64) {
      o = r.h0;
      n = r.h1;
      m = r.h2;
      l = r.h3;
      k = r.h4;
      for (g = 0; g < 16; ++g) {
        q = u.getInt32();
        p[g] = q;
        j = l ^ (n & (m ^ l));
        q = ((o << 5) | (o >>> 27)) + j + k + 1518500249 + q;
        k = l;
        l = m;
        m = (n << 30) | (n >>> 2);
        n = o;
        o = q
      }
      for (; g < 20; ++g) {
        q = (p[g - 3] ^ p[g - 8] ^ p[g - 14] ^ p[g - 16]);
        q = (q << 1) | (q >>> 31);
        p[g] = q;
        j = l ^ (n & (m ^ l));
        q = ((o << 5) | (o >>> 27)) + j + k + 1518500249 + q;
        k = l;
        l = m;
        m = (n << 30) | (n >>> 2);
        n = o;
        o = q
      }
      for (; g < 32; ++g) {
        q = (p[g - 3] ^ p[g - 8] ^ p[g - 14] ^ p[g - 16]);
        q = (q << 1) | (q >>> 31);
        p[g] = q;
        j = n ^ m ^ l;
        q = ((o << 5) | (o >>> 27)) + j + k + 1859775393 + q;
        k = l;
        l = m;
        m = (n << 30) | (n >>> 2);
        n = o;
        o = q
      }
      for (; g < 40; ++g) {
        q = (p[g - 6] ^ p[g - 16] ^ p[g - 28] ^ p[g - 32]);
        q = (q << 2) | (q >>> 30);
        p[g] = q;
        j = n ^ m ^ l;
        q = ((o << 5) | (o >>> 27)) + j + k + 1859775393 + q;
        k = l;
        l = m;
        m = (n << 30) | (n >>> 2);
        n = o;
        o = q
      }
      for (; g < 60; ++g) {
        q = (p[g - 6] ^ p[g - 16] ^ p[g - 28] ^ p[g - 32]);
        q = (q << 2) | (q >>> 30);
        p[g] = q;
        j = (n & m) | (l & (n ^ m));
        q = ((o << 5) | (o >>> 27)) + j + k + 2400959708 + q;
        k = l;
        l = m;
        m = (n << 30) | (n >>> 2);
        n = o;
        o = q
      }
      for (; g < 80; ++g) {
        q = (p[g - 6] ^ p[g - 16] ^ p[g - 28] ^ p[g - 32]);
        q = (q << 2) | (q >>> 30);
        p[g] = q;
        j = n ^ m ^ l;
        q = ((o << 5) | (o >>> 27)) + j + k + 3395469782 + q;
        k = l;
        l = m;
        m = (n << 30) | (n >>> 2);
        n = o;
        o = q
      }
      r.h0 += o;
      r.h1 += n;
      r.h2 += m;
      r.h3 += l;
      r.h4 += k;
      h -= 64
    }
  };
  e.create = function () {
    if (!b) {
      d()
    }
    var f = null;
    var i = forge.util.createBuffer();
    var g = new Array(80);
    var h = {
      algorithm: "sha1",
      blockLength: 64,
      digestLength: 20,
      messageLength: 0
    };
    h.start = function () {
      h.messageLength = 0;
      i = forge.util.createBuffer();
      f = {
        h0: 1732584193,
        h1: 4023233417,
        h2: 2562383102,
        h3: 271733878,
        h4: 3285377520
      };
      return h
    };
    h.start();
    h.update = function (k, j) {
      if (j === "utf8") {
        k = forge.util.encodeUtf8(k)
      }
      h.messageLength += k.length;
      i.putBytes(k);
      a(f, g, i);
      if (i.read > 2048 || i.length() === 0) {
        i.compact()
      };
      return h
    };
    h.digest = function () {
      var j = h.messageLength;
      var m = forge.util.createBuffer();
      m.putBytes(i.bytes());
      m.putBytes(c.substr(0, 64 - ((j + 8) % 64)));
      m.putInt32((j >>> 29) & 255);
      m.putInt32((j << 3) & 4294967295);
      var k = {
        h0: f.h0,
        h1: f.h1,
        h2: f.h2,
        h3: f.h3,
        h4: f.h4
      };
      a(k, g, m);
      var l = forge.util.createBuffer();
      l.putInt32(k.h0);
      l.putInt32(k.h1);
      l.putInt32(k.h2);
      l.putInt32(k.h3);
      l.putInt32(k.h4);
      return l
    };
    h.digest2 = function () {
      var j = h.messageLength;
      var o = forge.util.createBuffer();
      var k = forge.util.createBuffer(i.data.slice(i.read));
      var m = g.slice(0);
      o.putBytes(i.bytes());
      o.putBytes(c.substr(0, 64 - ((j + 8) % 64)));
      o.putInt32((j >>> 29) & 255);
      o.putInt32((j << 3) & 4294967295);
      var l = {
        h0: f.h0,
        h1: f.h1,
        h2: f.h2,
        h3: f.h3,
        h4: f.h4
      };
      a(l, g, o);
      var n = forge.util.createBuffer();
      n.putInt32(l.h0);
      n.putInt32(l.h1);
      n.putInt32(l.h2);
      n.putInt32(l.h3);
      n.putInt32(l.h4);
      i = k;
      g = m;
      return n
    };
    return h
  };
  e.createhash = function () {
    var g = e.create();
    var f = g.update;
    g.update = function (h) {
      return f(h.toString("binary"))
    };
    g.digest = function () {
      return g.digest2().toHex()
    };
    return g
  }
})();

//hmac.js (forge)

/**
 * Hash-based Message Authentication Code implementation. Requires a message
 * digest object that can be obtained, for example, from forge.md.sha1 or
 * forge.md.md5.
 *
 * @author Dave Longley
 *
 * Copyright (c) 2010-2012 Digital Bazaar, Inc. All rights reserved.
 */
(function () {
  var a = forge;
  a.hmac = {}; /*if(typeof(window)!=="undefined"){var a=window.forge=window.forge||{};a.hmac={}}else{if(typeof(module)!=="undefined"&&module.exports){var a={md:require("./md"),util:require("./util")};module.exports=a.hmac={}}}*/;
  var b = a.hmac;
  b.create = function () {
    var g = null;
    var e = null;
    var f = null;
    var c = null;
    var d = {};
    d.start = function (m, k) {
      if (m !== null) {
        if (m.constructor == String) {
          m = m.toLowerCase();
          if (m in a.md.algorithms) {
            e = a.md.algorithms[m].create()
          } else {
            throw 'Unknown hash algorithm "' + m + '"'
          }
        } else {
          e = m
        }
      }
      if (k === null) {
        k = g
      } else {
        if (k.constructor == String) {
          k = a.util.createBuffer(k)
        } else {
          if (k.constructor == Array) {
            var j = k;
            k = a.util.createBuffer();
            for (var h = 0; h < j.length; ++h) {
              k.putByte(j[h])
            }
          }
        }
        var l = k.length();
        if (l > e.blockLength) {
          e.start();
          e.update(k.bytes());
          k = e.digest()
        }
        f = a.util.createBuffer();
        c = a.util.createBuffer();
        l = k.length();
        for (var h = 0; h < l; ++h) {
          var j = k.at(h);
          f.putByte(54 ^ j);
          c.putByte(92 ^ j)
        }
        if (l < e.blockLength) {
          var j = e.blockLength - l;
          for (var h = 0; h < j; ++h) {
            f.putByte(54);
            c.putByte(92)
          }
        }
        g = k;
        f = f.bytes();
        c = c.bytes()
      }
      e.start();
      e.update(f)
    };
    d.update = function (h) {
      e.update(h)
    };
    d.getMac = function () {
      var h = e.digest().bytes();
      e.start();
      e.update(c);
      e.update(h);
      return e.digest()
    };
    d.digest = d.getMac;
    return d
  }
})();


//aes.js (forge)

(function () {
  var j = false;
  var h = 4;
  var f;
  var b;
  var d;
  var k;
  var g;
  var e = function () {
    j = true;
    d = [0, 1, 2, 4, 8, 16, 32, 64, 128, 27, 54];
    var x = new Array(256);
    for (var p = 0; p < 128; ++p) {
      x[p] = p << 1;
      x[p + 128] = (p + 128) << 1 ^ 283
    }
    f = new Array(256);
    b = new Array(256);
    k = new Array(4);
    g = new Array(4);
    for (var p = 0; p < 4; ++p) {
      k[p] = new Array(256);
      g[p] = new Array(256)
    }
    var s = 0,
      o = 0,
      v, t, q, w, l, u, r;
    for (var p = 0; p < 256; ++p) {
      w = o ^ (o << 1) ^ (o << 2) ^ (o << 3) ^ (o << 4);
      w = (w >> 8) ^ (w & 255) ^ 99;
      f[s] = w;
      b[w] = s;
      l = x[w];
      v = x[s];
      t = x[v];
      q = x[t];
      u = (l << 24) ^ (w << 16) ^ (w << 8) ^ (w ^ l);
      r = (v ^ t ^ q) << 24 ^ (s ^ q) << 16 ^ (s ^ t ^ q) << 8 ^ (s ^ v ^ q);
      for (var m = 0; m < 4; ++m) {
        k[m][s] = u;
        g[m][w] = r;
        u = u << 24 | u >>> 8;
        r = r << 24 | r >>> 8
      }
      if (s === 0) {
        s = o = 1
      } else {
        s = v ^ x[x[x[v ^ q]]];
        o ^= x[x[o]]
      }
    }
  };
  var a = function (z, o) {
    var x = z.slice(0);
    var B, m = 1;
    var r = x.length;
    var p = r + 6 + 1;
    var s = h * p;
    for (var u = r; u < s; ++u) {
      B = x[u - 1];
      if (u % r === 0) {
        B = f[B >>> 16 & 255] << 24 ^ f[B >>> 8 & 255] << 16 ^ f[B & 255] << 8 ^ f[B >>> 24] ^ (d[m] << 24);
        m++
      } else {
        if (r > 6 && (u % r === 4)) {
          B = f[B >>> 24] << 24 ^ f[B >>> 16 & 255] << 16 ^ f[B >>> 8 & 255] << 8 ^ f[B & 255]
        }
      }
      x[u] = x[u - r] ^ B
    }
    if (o) {
      var t;
      var D = g[0];
      var C = g[1];
      var A = g[2];
      var y = g[3];
      var v = x.slice(0);
      var s = x.length;
      for (var u = 0, l = s - h; u < s; u += h, l -= h) {
        if (u === 0 || u === (s - h)) {
          v[u] = x[l];
          v[u + 1] = x[l + 3];
          v[u + 2] = x[l + 2];
          v[u + 3] = x[l + 1]
        } else {
          for (var q = 0; q < h; ++q) {
            t = x[l + q];
            v[u + (3 & -q)] = D[f[t >>> 24]] ^ C[f[t >>> 16 & 255]] ^ A[f[t >>> 8 & 255]] ^ y[f[t & 255]]
          }
        }
      }
      x = v
    }
    return x
  };
  var c = function (u, v, t, o) {
    var q = u.length / 4 - 1;
    var p, n, m, l, s;
    if (o) {
      p = g[0];
      n = g[1];
      m = g[2];
      l = g[3];
      s = b
    } else {
      p = k[0];
      n = k[1];
      m = k[2];
      l = k[3];
      s = f
    }
    var D, C, A, z, E, r, x;
    D = v[0] ^ u[0];
    C = v[o ? 3 : 1] ^ u[1];
    A = v[2] ^ u[2];
    z = v[o ? 1 : 3] ^ u[3];
    var y = 3;
    for (var B = 1; B < q; ++B) {
      E = p[D >>> 24] ^ n[C >>> 16 & 255] ^ m[A >>> 8 & 255] ^ l[z & 255] ^ u[++y];
      r = p[C >>> 24] ^ n[A >>> 16 & 255] ^ m[z >>> 8 & 255] ^ l[D & 255] ^ u[++y];
      x = p[A >>> 24] ^ n[z >>> 16 & 255] ^ m[D >>> 8 & 255] ^ l[C & 255] ^ u[++y];
      z = p[z >>> 24] ^ n[D >>> 16 & 255] ^ m[C >>> 8 & 255] ^ l[A & 255] ^ u[++y];
      D = E;
      C = r;
      A = x
    }
    t[0] = (s[D >>> 24] << 24) ^ (s[C >>> 16 & 255] << 16) ^ (s[A >>> 8 & 255] << 8) ^ (s[z & 255]) ^ u[++y];
    t[o ? 3 : 1] = (s[C >>> 24] << 24) ^ (s[A >>> 16 & 255] << 16) ^ (s[z >>> 8 & 255] << 8) ^ (s[D & 255]) ^ u[++y];
    t[2] = (s[A >>> 24] << 24) ^ (s[z >>> 16 & 255] << 16) ^ (s[D >>> 8 & 255] << 8) ^ (s[C & 255]) ^ u[++y];
    t[o ? 1 : 3] = (s[z >>> 24] << 24) ^ (s[D >>> 16 & 255] << 16) ^ (s[C >>> 8 & 255] << 8) ^ (s[A & 255]) ^ u[++y]
  };
  var i = function (H, r, u, o, v) {
    var m = null;
    if (!j) {
      e()
    }
    v = (v || "CBC").toUpperCase();
    if (typeof H === "string" && (H.length === 16 || H.length === 24 || H.length === 32)) {
      H = forge.util.createBuffer(H)
    } else {
      if (forge.util.isArray(H) && (H.length === 16 || H.length === 24 || H.length === 32)) {
        var B = H;
        var H = forge.util.createBuffer();
        for (var x = 0; x < B.length; ++x) {
          H.putByte(B[x])
        }
      }
    }
    if (!forge.util.isArray(H)) {
      var B = H;
      H = [];
      var z = B.length();
      if (z === 16 || z === 24 || z === 32) {
        z = z >>> 2;
        for (var x = 0; x < z; ++x) {
          H.push(B.getInt32())
        }
      }
    }
    if (!forge.util.isArray(H) || !(H.length === 4 || H.length === 6 || H.length === 8)) {
      return m
    }
    var I = (["CFB", "OFB", "CTR"].indexOf(v) !== -1);
    var p = (v === "CBC");
    var A = a(H, o && !I);
    var w = h << 2;
    var n;
    var y;
    var s;
    var D;
    var q;
    var l;
    var F;
    m = {
      output: null
    };
    if (v === "CBC") {
      F = E
    } else {
      if (v === "CFB") {
        F = G
      } else {
        if (v === "OFB") {
          F = t
        } else {
          if (v === "CTR") {
            F = C
          } else {
            throw {
              message: 'Unsupported block cipher mode of operation: "' + v + '"'
            }
          }
        }
      }
    }
    m.update = function (J) {
      if (!l) {
        n.putBuffer(J)
      }
      while (n.length() >= w || (n.length() > 0 && l)) {
        F()
      }
    };
    m.update2 = function (J) {
      if (J) {
        if (J.length()) {
          n.data = n.data.substr(n.read);
          n.read = 0;
          n.putBuffer(J)
        }
      }
      while (n.length() >= w) {
        F()
      }
      if (m.overflow) {
        y.getBytes(m.overflow)
      }
      var M = n.length() % w;
      if (M) {
        var K = forge.util.createBuffer(n.data.slice(n.read));
        var L = s.slice(0);
        while (n.length() > 0) {
          F()
        }
        n = K;
        s = L;
        y.truncate(w - M)
      } else /*modif Aym */ {
        n.data = '';
        n.read = 0
      };
      m.overflow = M
    };
    m.finish = function (N) {
      var M = true;
      var O = n.length() % w;
      if (!o) {
        if (N) {
          M = N(w, n, o)
        } else {
          if (p) {
            var L = (n.length() === w) ? w : (w - n.length());
            n.fillWithByte(L, L)
          }
        }
      }
      if (M) {
        l = true;
        m.update()
      }
      if (o) {
        if (p) {
          M = (O === 0)
        }
        if (M) {
          if (N) {
            M = N(w, y, o)
          } else {
            if (p) {
              var J = y.length();
              var K = y.at(J - 1);
              if (K > (h << 2)) {
                M = false
              } else {
                y.truncate(K)
              }
            }
          }
        }
      }
      if (!p && !N && O > 0) {
        y.truncate(w - O)
      }
      return M
    };
    m.start = function (K, J) {
      if (K === null) {
        K = q.slice(0)
      }
      if (typeof K === "string" && K.length === 16) {
        K = forge.util.createBuffer(K)
      } else {
        if (forge.util.isArray(K) && K.length === 16) {
          var M = K;
          var K = forge.util.createBuffer();
          for (var L = 0; L < 16; ++L) {
            K.putByte(M[L])
          }
        }
      }
      if (!forge.util.isArray(K)) {
        var M = K;
        K = new Array(4);
        K[0] = M.getInt32();
        K[1] = M.getInt32();
        K[2] = M.getInt32();
        K[3] = M.getInt32()
      }
      n = forge.util.createBuffer();
      y = J || forge.util.createBuffer();
      q = K.slice(0);
      s = new Array(h);
      D = new Array(h);
      l = false;
      m.output = y;
      if (["CFB", "OFB", "CTR"].indexOf(v) !== -1) {
        for (var L = 0; L < h; ++L) {
          s[L] = q[L]
        }
        q = null
      }
    };
    if (r !== null) {
      m.start(r, u)
    }
    return m;

    function E() {
      if (o) {
        for (var J = 0; J < h; ++J) {
          s[J] = n.getInt32()
        }
      } else {
        for (var J = 0; J < h; ++J) {
          s[J] = q[J] ^ n.getInt32()
        }
      }
      c(A, s, D, o);
      if (o) {
        for (var J = 0; J < h; ++J) {
          y.putInt32(q[J] ^ D[J])
        }
        q = s.slice(0)
      } else {
        for (var J = 0; J < h; ++J) {
          y.putInt32(D[J])
        }
        q = D
      }
    }

    function G() {
      c(A, s, D, false);
      for (var K = 0; K < h; ++K) {
        s[K] = n.getInt32()
      }
      for (var K = 0; K < h; ++K) {
        var J = s[K] ^ D[K];
        if (!o) {
          s[K] = J
        }
        y.putInt32(J)
      }
    }

    function t() {
      c(A, s, D, false);
      for (var J = 0; J < h; ++J) {
        s[J] = n.getInt32()
      }
      for (var J = 0; J < h; ++J) {
        y.putInt32(s[J] ^ D[J]);
        s[J] = D[J]
      }
    }

    function C() {
      c(A, s, D, false);
      for (var J = h - 1; J >= 0; --J) {
        if (s[J] === 4294967295) {
          s[J] = 0
        } else {
          ++s[J];
          break
        }
      }
      for (var J = 0; J < h; ++J) {
        y.putInt32(n.getInt32() ^ D[J])
      }
    }
  };
  forge.aes = forge.aes || {};
  forge.aes.startEncrypting = function (n, m, l, o) {
    return i(n, m, l, false, o)
  };
  forge.aes.createEncryptionCipher = function (l, m) {
    return i(l, null, null, false, m)
  };
  forge.aes.startDecrypting = function (n, m, l, o) {
    return i(n, m, l, true, o)
  };
  forge.aes.createDecryptionCipher = function (l, m) {
    return i(l, null, null, true, m)
  };
  forge.aes._expandKey = function (m, l) {
    if (!j) {
      e()
    }
    return a(m, l)
  };
  forge.aes._updateBlock = c;
  forge.aes.createcipheriv = function (r, o, n) {
    var q = r.split("-")[2];
    var m = forge.util.createBuffer();
    o = forge.util.createBuffer(o.toString("binary"));
    n = forge.util.createBuffer(n.toString("binary"));
    var l = forge.aes.startEncrypting(o, n, m, q);
    var p = l.update2;
    l.update = function (t) {
      var s;
      if (t) {
        t = forge.util.createBuffer(t.toString("binary"))
      } else {
        t = forge.util.createBuffer()
      }
      p(t);
      s = m.toHex();
      m.data = "";
      m.read = 0;
      return s
    };
    return l
  }
})();

//asn1.js (forge)

/**
 * Javascript implementation of Abstract Syntax Notation Number One.
 *
 * @author Dave Longley
 *
 * Copyright (c) 2010-2012 Digital Bazaar, Inc.
 *
 **/
(function () {
  var b = forge;
  b.asn1 = {}; /*if(typeof(window)!=="undefined"){var b=window.forge=window.forge||{};b.asn1={}}else{if(typeof(module)!=="undefined"&&module.exports){var b={util:require("./util"),pki:{oids:require("./oids")}};module.exports=b.asn1={}}}*/;
  var a = b.asn1;
  a.Class = {
    UNIVERSAL: 0,
    APPLICATION: 64,
    CONTEXT_SPECIFIC: 128,
    PRIVATE: 192
  };
  a.Type = {
    NONE: 0,
    BOOLEAN: 1,
    INTEGER: 2,
    BITSTRING: 3,
    OCTETSTRING: 4,
    NULL: 5,
    OID: 6,
    ODESC: 7,
    EXTERNAL: 8,
    REAL: 9,
    ENUMERATED: 10,
    EMBEDDED: 11,
    UTF8: 12,
    ROID: 13,
    SEQUENCE: 16,
    SET: 17,
    PRINTABLESTRING: 19,
    IA5STRING: 22,
    UTCTIME: 23,
    GENERALIZEDTIME: 24,
    BMPSTRING: 30
  };
  a.create = function (h, e, g, f) {
    return {
      tagClass: h,
      type: e,
      constructed: g,
      composed: g || (f.constructor == Array),
      value: f
    }
  };
  var c = function (e) {
    var f = e.getByte();
    if (f == 128) {
      return undefined
    }
    var h;
    var g = f & 128;
    if (!g) {
      h = f
    } else {
      h = e.getInt((f & 127) << 3)
    }
    return h
  };
  a.fromDer = function (t) {
    if (t.constructor == String) {
      t = b.util.createBuffer(t)
    }
    if (t.length() < 2) {
      throw {
        message: "Too few bytes to parse DER.",
        bytes: t.length()
      }
    }
    var r = t.getByte();
    var m = (r & 192);
    var q = r & 31;
    var g = c(t);
    if (t.length() < g) {
      throw {
        message: "Too few bytes to read ASN.1 value.",
        detail: t.length() + " < " + g
      }
    }
    var s;
    var k = ((r & 32) == 32);
    var p = k;
    if (!p && m === a.Class.UNIVERSAL && q === a.Type.BITSTRING && g > 1) {
      var f = t.read;
      var h = t.getByte();
      if (h === 0) {
        r = t.getByte();
        var j = (r & 192);
        if (j === a.Class.UNIVERSAL || j === a.Class.CONTEXT_SPECIFIC) {
          try {
            var n = c(t);
            p = (n === g - (t.read - f));
            if (p) {
              ++f;
              --g
            }
          } catch (o) { }
        }
      }
      t.read = f
    }
    if (p) {
      s = [];
      if (g === undefined) {
        for (; ;) {
          if (t.bytes(2) === String.fromCharCode(0, 0)) {
            t.getBytes(2);
            break
          }
          s.push(a.fromDer(t))
        }
      } else {
        var e = t.length();
        while (g > 0) {
          s.push(a.fromDer(t));
          g -= e - t.length();
          e = t.length()
        }
      }
    } else {
      if (g === undefined) {
        throw {
          message: "Non-constructed ASN.1 object of indefinite length."
        }
      }
      if (q === a.Type.BMPSTRING) {
        s = "";
        for (var l = 0; l < g; l += 2) {
          s += String.fromCharCode(t.getInt16())
        }
      } else {
        s = t.getBytes(g)
      }
    };
    return a.create(m, q, k, s)
  };
  a.toDer = function (l) {
    var g = b.util.createBuffer();
    var h = l.tagClass | l.type;
    var k = b.util.createBuffer();
    if (l.composed) {
      if (l.constructed) {
        h |= 32
      } else {
        k.putByte(0)
      }
      for (var j = 0; j < l.value.length; ++j) {
        if (l.value[j] !== undefined) {
          k.putBuffer(a.toDer(l.value[j]))
        }
      }
    } else {
      k.putBytes(l.value)
    }
    g.putByte(h);
    if (k.length() <= 127) {
      g.putByte(k.length() & 127)
    } else {
      var f = k.length();
      var e = "";
      do {
        e += String.fromCharCode(f & 255);
        f = f >>> 8
      } while (f > 0);
      g.putByte(e.length | 128);
      for (var j = e.length - 1; j >= 0; --j) {
        g.putByte(e.charCodeAt(j))
      }
    }
    g.putBuffer(k);
    return g
  };
  a.oidToDer = function (g) {
    var m = g.split(".");
    var o = b.util.createBuffer();
    o.putByte(40 * parseInt(m[0], 10) + parseInt(m[1], 10));
    var l, e, k, j;
    for (var h = 2; h < m.length; ++h) {
      l = true;
      e = [];
      k = parseInt(m[h], 10);
      do {
        j = k & 127;
        k = k >>> 7;
        if (!l) {
          j |= 128
        }
        e.push(j);
        l = false
      } while (k > 0);
      for (var f = e.length - 1; f >= 0; --f) {
        o.putByte(e[f])
      }
    }
    return o
  };
  a.derToOid = function (f) {
    var g;
    if (f.constructor == String) {
      f = b.util.createBuffer(f)
    }
    var e = f.getByte();
    g = Math.floor(e / 40) + "." + (e % 40);
    var h = 0;
    while (f.length() > 0) {
      e = f.getByte();
      h = h << 7;
      if (e & 128) {
        h += e & 127
      } else {
        g += "." + (h + e);
        h = 0
      }
    }
    return g
  };
  a.utcTimeToDate = function (o) {
    var g = new Date();
    var n = parseInt(o.substr(0, 2), 10);
    n = (n >= 50) ? 1900 + n : 2000 + n;
    var p = parseInt(o.substr(2, 2), 10) - 1;
    var l = parseInt(o.substr(4, 2), 10);
    var h = parseInt(o.substr(6, 2), 10);
    var j = parseInt(o.substr(8, 2), 10);
    var q = 0;
    if (o.length > 11) {
      var m = o.charAt(10);
      var i = 10;
      if (m !== "+" && m !== "-") {
        q = parseInt(o.substr(10, 2), 10);
        i += 2
      }
    }
    g.setUTCFullYear(n, p, l);
    g.setUTCHours(h, j, q, 0);
    if (i) {
      m = o.charAt(i);
      if (m === "+" || m === "-") {
        var e = parseInt(o.substr(i + 1, 2), 10);
        var f = parseInt(o.substr(i + 4, 2), 10);
        var k = e * 60 + f;
        k *= 60000;
        if (m === "+") {
          g.setTime(+g - k)
        } else {
          g.setTime(+g + k)
        }
      }
    }
    return g
  };
  a.generalizedTimeToDate = function (p) {
    var i = new Date();
    var j = parseInt(p.substr(0, 4), 10);
    var r = parseInt(p.substr(4, 2), 10) - 1;
    var o = parseInt(p.substr(6, 2), 10);
    var k = parseInt(p.substr(8, 2), 10);
    var m = parseInt(p.substr(10, 2), 10);
    var s = parseInt(p.substr(12, 2), 10);
    var h = 0;
    var n = 0;
    var g = false;
    if (p.charAt(p.length - 1) == "Z") {
      g = true
    }
    var l = p.length - 5,
      q = p.charAt(l);
    if (q === "+" || q === "-") {
      var e = parseInt(p.substr(l + 1, 2), 10);
      var f = parseInt(p.substr(l + 4, 2), 10);
      n = e * 60 + f;
      n *= 60000;
      if (q === "+") {
        n *= -1
      }
      g = true
    }
    if (p.charAt(14) == ".") {
      h = parseFloat(p.substr(14), 10) * 1000
    }
    if (g) {
      i.setUTCFullYear(j, r, o);
      i.setUTCHours(k, m, s, h);
      i.setTime(+i + n)
    } else {
      i.setFullYear(j, r, o);
      i.setHours(k, m, s, h)
    }
    return i
  };
  a.dateToUtcTime = function (e) {
    var h = "";
    var g = [];
    g.push(("" + e.getUTCFullYear()).substr(2));
    g.push("" + (e.getUTCMonth() + 1));
    g.push("" + e.getUTCDate());
    g.push("" + e.getUTCHours());
    g.push("" + e.getUTCMinutes());
    g.push("" + e.getUTCSeconds());
    for (var f = 0; f < g.length; ++f) {
      if (g[f].length < 2) {
        h += "0"
      }
      h += g[f]
    }
    h += "Z";
    return h
  };
  a.validate = function (l, f, e, m) {
    var k = false;
    if ((l.tagClass === f.tagClass || typeof (f.tagClass) === "undefined") && (l.type === f.type || typeof (f.type) === "undefined")) {
      if (l.constructed === f.constructed || typeof (f.constructed) === "undefined") {
        k = true;
        if (f.value && f.value.constructor == Array) {
          var g = 0;
          for (var h = 0; k && h < f.value.length; ++h) {
            k = f.value[h].optional || false;
            if (l.value[g]) {
              k = a.validate(l.value[g], f.value[h], e, m);
              if (k) {
                ++g
              } else {
                if (f.value[h].optional) {
                  k = true
                }
              }
            }
            if (!k && m) {
              m.push("[" + f.name + '] Tag class "' + f.tagClass + '", type "' + f.type + '" expected value length "' + f.value.length + '", got "' + l.value.length + '"')
            }
          }
        }
        if (k && e) {
          if (f.capture) {
            e[f.capture] = l.value
          }
          if (f.captureAsn1) {
            e[f.captureAsn1] = l
          }
        }
      } else {
        if (m) {
          m.push("[" + f.name + '] Expected constructed "' + f.constructed + '", got "' + l.constructed + '"')
        }
      }
    } else {
      if (m) {
        if (l.tagClass !== f.tagClass) {
          m.push("[" + f.name + '] Expected tag class "' + f.tagClass + '", got "' + l.tagClass + '"')
        }
        if (l.type !== f.type) {
          m.push("[" + f.name + '] Expected type "' + f.type + '", got "' + l.type + '"')
        }
      }
    }
    return k
  };
  var d = /[^\\u0000-\\u00ff]/;
  a.prettyPrint = function (k, l, f) {
    var j = "";
    l = l || 0;
    f = f || 2;
    if (l > 0) {
      j += "\n"
    }
    var e = "";
    for (var g = 0; g < l * f; ++g) {
      e += " "
    }
    j += e + "Tag: ";
    switch (k.tagClass) {
      case a.Class.UNIVERSAL:
        j += "Universal:";
        break;
      case a.Class.APPLICATION:
        j += "Application:";
        break;
      case a.Class.CONTEXT_SPECIFIC:
        j += "Context-Specific:";
        break;
      case a.Class.PRIVATE:
        j += "Private:";
        break
    }
    if (k.tagClass === a.Class.UNIVERSAL) {
      j += k.type;
      switch (k.type) {
        case a.Type.NONE:
          j += " (None)";
          break;
        case a.Type.BOOLEAN:
          j += " (Boolean)";
          break;
        case a.Type.BITSTRING:
          j += " (Bit string)";
          break;
        case a.Type.INTEGER:
          j += " (Integer)";
          break;
        case a.Type.OCTETSTRING:
          j += " (Octet string)";
          break;
        case a.Type.NULL:
          j += " (Null)";
          break;
        case a.Type.OID:
          j += " (Object Identifier)";
          break;
        case a.Type.ODESC:
          j += " (Object Descriptor)";
          break;
        case a.Type.EXTERNAL:
          j += " (External or Instance of)";
          break;
        case a.Type.REAL:
          j += " (Real)";
          break;
        case a.Type.ENUMERATED:
          j += " (Enumerated)";
          break;
        case a.Type.EMBEDDED:
          j += " (Embedded PDV)";
          break;
        case a.Type.UTF8:
          j += " (UTF8)";
          break;
        case a.Type.ROID:
          j += " (Relative Object Identifier)";
          break;
        case a.Type.SEQUENCE:
          j += " (Sequence)";
          break;
        case a.Type.SET:
          j += " (Set)";
          break;
        case a.Type.PRINTABLESTRING:
          j += " (Printable String)";
          break;
        case a.Type.IA5String:
          j += " (IA5String (ASCII))";
          break;
        case a.Type.UTCTIME:
          j += " (UTC time)";
          break;
        case a.Type.GENERALIZEDTIME:
          j += " (Generalized time)";
          break;
        case a.Type.BMPSTRING:
          j += " (BMP String)";
          break
      }
    } else {
      j += k.type
    }
    j += "\n";
    j += e + "Constructed: " + k.constructed + "\n";
    if (k.composed) {
      j += e + "Sub values: " + k.value.length;
      for (var g = 0; g < k.value.length; ++g) {
        j += a.prettyPrint(k.value[g], l + 1, f);
        if ((g + 1) < k.value.length) {
          j += ","
        }
      }
    } else {
      j += e + "Value: ";
      if (k.type === a.Type.OID) {
        var h = a.derToOid(k.value);
        j += h;
        if (b.pki && b.pki.oids) {
          if (h in b.pki.oids) {
            j += " (" + b.pki.oids[h] + ")"
          }
        }
      } else {
        if (d.test(k.value)) {
          j += "0x" + b.util.createBuffer(k.value, "utf8").toHex()
        } else {
          if (k.value.length === 0) {
            j += "[null]"
          } else {
            j += k.value
          }
        }
      }
    }
    return j
  }
})();

/*
jsbn.js (forge and RSA)
Tom Wu BSD License
http://www-cs-students.stanford.edu/~tjw/jsbn/
*/

var dbits;
var canary = 244837814094590;
var j_lm = ((canary & 16777215) == 15715070);

function BigInteger(e, d, f) {
  if (e != null) {
    if ("number" == typeof e) {
      this.fromNumber(e, d, f)
    } else {
      if (d == null && "string" != typeof e) {
        this.fromString(e, 256)
      } else {
        this.fromString(e, d)
      }
    }
  }
}

function nbi() {
  return new BigInteger(null)
}

function am1(f, a, b, e, h, g) {
  while (--g >= 0) {
    var d = a * this[f++] + b[e] + h;
    h = Math.floor(d / 67108864);
    b[e++] = d & 67108863
  }
  return h
}

function am2(f, q, r, e, o, a) {
  var k = q & 32767,
    p = q >> 15;
  while (--a >= 0) {
    var d = this[f] & 32767;
    var g = this[f++] >> 15;
    var b = p * d + g * k;
    d = k * d + ((b & 32767) << 15) + r[e] + (o & 1073741823);
    o = (d >>> 30) + (b >>> 15) + p * g + (o >>> 30);
    r[e++] = d & 1073741823
  }
  return o
}

function am3(f, q, r, e, o, a) {
  var k = q & 16383,
    p = q >> 14;
  while (--a >= 0) {
    var d = this[f] & 16383;
    var g = this[f++] >> 14;
    var b = p * d + g * k;
    d = k * d + ((b & 16383) << 14) + r[e] + o;
    o = (d >> 28) + (b >> 14) + p * g;
    r[e++] = d & 268435455
  }
  return o
}
if (typeof (navigator) === "undefined") {
  BigInteger.prototype.am = am3;
  dbits = 28
} else {
  BigInteger.prototype.am = am3;
  dbits = 28
}
BigInteger.prototype.DB = dbits;
BigInteger.prototype.DM = ((1 << dbits) - 1);
BigInteger.prototype.DV = (1 << dbits);
var BI_FP = 52;
BigInteger.prototype.FV = Math.pow(2, BI_FP);
BigInteger.prototype.F1 = BI_FP - dbits;
BigInteger.prototype.F2 = 2 * dbits - BI_FP;
var BI_RM = "0123456789abcdefghijklmnopqrstuvwxyz";
var BI_RC = new Array();
var rr, vv;
rr = "0".charCodeAt(0);
for (vv = 0; vv <= 9; ++vv) {
  BI_RC[rr++] = vv
}
rr = "a".charCodeAt(0);
for (vv = 10; vv < 36; ++vv) {
  BI_RC[rr++] = vv
}
rr = "A".charCodeAt(0);
for (vv = 10; vv < 36; ++vv) {
  BI_RC[rr++] = vv
}

function int2char(a) {
  return BI_RM.charAt(a)
}

function intAt(b, a) {
  var d = BI_RC[b.charCodeAt(a)];
  return (d == null) ? -1 : d
}

function bnpCopyTo(b) {
  for (var a = this.t - 1; a >= 0; --a) {
    b[a] = this[a]
  }
  b.t = this.t;
  b.s = this.s
}

function bnpFromInt(a) {
  this.t = 1;
  this.s = (a < 0) ? -1 : 0;
  if (a > 0) {
    this[0] = a
  } else {
    if (a < -1) {
      this[0] = a + DV
    } else {
      this.t = 0
    }
  }
}

function nbv(a) {
  var b = nbi();
  b.fromInt(a);
  return b
}

function bnpFromString(h, c) {
  var e;
  if (c == 16) {
    e = 4
  } else {
    if (c == 8) {
      e = 3
    } else {
      if (c == 256) {
        e = 8
      } else {
        if (c == 2) {
          e = 1
        } else {
          if (c == 32) {
            e = 5
          } else {
            if (c == 4) {
              e = 2
            } else {
              this.fromRadix(h, c);
              return
            }
          }
        }
      }
    }
  }
  this.t = 0;
  this.s = 0;
  var g = h.length,
    d = false,
    f = 0;
  while (--g >= 0) {
    var a = (e == 8) ? h[g] & 255 : intAt(h, g);
    if (a < 0) {
      if (h.charAt(g) == "-") {
        d = true
      }
      continue
    }
    d = false;
    if (f == 0) {
      this[this.t++] = a
    } else {
      if (f + e > this.DB) {
        this[this.t - 1] |= (a & ((1 << (this.DB - f)) - 1)) << f;
        this[this.t++] = (a >> (this.DB - f))
      } else {
        this[this.t - 1] |= a << f
      }
    }
    f += e;
    if (f >= this.DB) {
      f -= this.DB
    }
  }
  if (e == 8 && (h[0] & 128) != 0) {
    this.s = -1;
    if (f > 0) {
      this[this.t - 1] |= ((1 << (this.DB - f)) - 1) << f
    }
  }
  this.clamp();
  if (d) {
    BigInteger.ZERO.subTo(this, this)
  }
}

function bnpClamp() {
  var a = this.s & this.DM;
  while (this.t > 0 && this[this.t - 1] == a) {
    --this.t
  }
}

function bnToString(c) {
  if (this.s < 0) {
    return "-" + this.negate().toString(c)
  }
  var e;
  if (c == 16) {
    e = 4
  } else {
    if (c == 8) {
      e = 3
    } else {
      if (c == 2) {
        e = 1
      } else {
        if (c == 32) {
          e = 5
        } else {
          if (c == 4) {
            e = 2
          } else {
            return this.toRadix(c)
          }
        }
      }
    }
  }
  var g = (1 << e) - 1,
    l, a = false,
    h = "",
    f = this.t;
  var j = this.DB - (f * this.DB) % e;
  if (f-- > 0) {
    if (j < this.DB && (l = this[f] >> j) > 0) {
      a = true;
      h = int2char(l)
    }
    while (f >= 0) {
      if (j < e) {
        l = (this[f] & ((1 << j) - 1)) << (e - j);
        l |= this[--f] >> (j += this.DB - e)
      } else {
        l = (this[f] >> (j -= e)) & g;
        if (j <= 0) {
          j += this.DB;
          --f
        }
      }
      if (l > 0) {
        a = true
      }
      if (a) {
        h += int2char(l)
      }
    }
  }
  return a ? h : "0"
}

function bnNegate() {
  var a = nbi();
  BigInteger.ZERO.subTo(this, a);
  return a
}

function bnAbs() {
  return (this.s < 0) ? this.negate() : this
}

function bnCompareTo(b) {
  var d = this.s - b.s;
  if (d != 0) {
    return d
  }
  var c = this.t;
  d = c - b.t;
  if (d != 0) {
    return d
  }
  while (--c >= 0) {
    if ((d = this[c] - b[c]) != 0) {
      return d
    }
  }
  return 0
}

function nbits(a) {
  var c = 1,
    b;
  if ((b = a >>> 16) != 0) {
    a = b;
    c += 16
  }
  if ((b = a >> 8) != 0) {
    a = b;
    c += 8
  }
  if ((b = a >> 4) != 0) {
    a = b;
    c += 4
  }
  if ((b = a >> 2) != 0) {
    a = b;
    c += 2
  }
  if ((b = a >> 1) != 0) {
    a = b;
    c += 1
  }
  return c
}

function bnBitLength() {
  if (this.t <= 0) {
    return 0
  }
  return this.DB * (this.t - 1) + nbits(this[this.t - 1] ^ (this.s & this.DM))
}

function bnpDLShiftTo(c, b) {
  var a;
  for (a = this.t - 1; a >= 0; --a) {
    b[a + c] = this[a]
  }
  for (a = c - 1; a >= 0; --a) {
    b[a] = 0
  }
  b.t = this.t + c;
  b.s = this.s
}

function bnpDRShiftTo(c, b) {
  for (var a = c; a < this.t; ++a) {
    b[a - c] = this[a]
  }
  b.t = Math.max(this.t - c, 0);
  b.s = this.s
}

function bnpLShiftTo(j, e) {
  var b = j % this.DB;
  var a = this.DB - b;
  var g = (1 << a) - 1;
  var f = Math.floor(j / this.DB),
    h = (this.s << b) & this.DM,
    d;
  for (d = this.t - 1; d >= 0; --d) {
    e[d + f + 1] = (this[d] >> a) | h;
    h = (this[d] & g) << b
  }
  for (d = f - 1; d >= 0; --d) {
    e[d] = 0
  }
  e[f] = h;
  e.t = this.t + f + 1;
  e.s = this.s;
  e.clamp()
}

function bnpRShiftTo(g, d) {
  d.s = this.s;
  var e = Math.floor(g / this.DB);
  if (e >= this.t) {
    d.t = 0;
    return
  }
  var b = g % this.DB;
  var a = this.DB - b;
  var f = (1 << b) - 1;
  d[0] = this[e] >> b;
  for (var c = e + 1; c < this.t; ++c) {
    d[c - e - 1] |= (this[c] & f) << a;
    d[c - e] = this[c] >> b
  }
  if (b > 0) {
    d[this.t - e - 1] |= (this.s & f) << a
  }
  d.t = this.t - e;
  d.clamp()
}

function bnpSubTo(d, f) {
  var e = 0,
    g = 0,
    b = Math.min(d.t, this.t);
  while (e < b) {
    g += this[e] - d[e];
    f[e++] = g & this.DM;
    g >>= this.DB
  }
  if (d.t < this.t) {
    g -= d.s;
    while (e < this.t) {
      g += this[e];
      f[e++] = g & this.DM;
      g >>= this.DB
    }
    g += this.s
  } else {
    g += this.s;
    while (e < d.t) {
      g -= d[e];
      f[e++] = g & this.DM;
      g >>= this.DB
    }
    g -= d.s
  }
  f.s = (g < 0) ? -1 : 0;
  if (g < -1) {
    f[e++] = this.DV + g
  } else {
    if (g > 0) {
      f[e++] = g
    }
  }
  f.t = e;
  f.clamp()
}

function bnpMultiplyTo(c, e) {
  var b = this.abs(),
    f = c.abs();
  var d = b.t;
  e.t = d + f.t;
  while (--d >= 0) {
    e[d] = 0
  }
  for (d = 0; d < f.t; ++d) {
    e[d + b.t] = b.am(0, f[d], e, d, 0, b.t)
  }
  e.s = 0;
  e.clamp();
  if (this.s != c.s) {
    BigInteger.ZERO.subTo(e, e)
  }
}

function bnpSquareTo(d) {
  var a = this.abs();
  var b = d.t = 2 * a.t;
  while (--b >= 0) {
    d[b] = 0
  }
  for (b = 0; b < a.t - 1; ++b) {
    var e = a.am(b, a[b], d, 2 * b, 0, 1);
    if ((d[b + a.t] += a.am(b + 1, 2 * a[b], d, 2 * b + 1, e, a.t - b - 1)) >= a.DV) {
      d[b + a.t] -= a.DV;
      d[b + a.t + 1] = 1
    }
  }
  if (d.t > 0) {
    d[d.t - 1] += a.am(b, a[b], d, 2 * b, 0, 1)
  }
  d.s = 0;
  d.clamp()
}

function bnpDivRemTo(n, h, g) {
  var w = n.abs();
  if (w.t <= 0) {
    return
  }
  var k = this.abs();
  if (k.t < w.t) {
    if (h != null) {
      h.fromInt(0)
    }
    if (g != null) {
      this.copyTo(g)
    }
    return
  }
  if (g == null) {
    g = nbi()
  }
  var d = nbi(),
    a = this.s,
    l = n.s;
  var v = this.DB - nbits(w[w.t - 1]);
  if (v > 0) {
    w.lShiftTo(v, d);
    k.lShiftTo(v, g)
  } else {
    w.copyTo(d);
    k.copyTo(g)
  }
  var p = d.t;
  var b = d[p - 1];
  if (b == 0) {
    return
  }
  var o = b * (1 << this.F1) + ((p > 1) ? d[p - 2] >> this.F2 : 0);
  var A = this.FV / o,
    z = (1 << this.F1) / o,
    x = 1 << this.F2;
  var u = g.t,
    s = u - p,
    f = (h == null) ? nbi() : h;
  d.dlShiftTo(s, f);
  if (g.compareTo(f) >= 0) {
    g[g.t++] = 1;
    g.subTo(f, g)
  }
  BigInteger.ONE.dlShiftTo(p, f);
  f.subTo(d, d);
  while (d.t < p) {
    d[d.t++] = 0
  }
  while (--s >= 0) {
    var c = (g[--u] == b) ? this.DM : Math.floor(g[u] * A + (g[u - 1] + x) * z);
    if ((g[u] += d.am(0, c, g, s, 0, p)) < c) {
      d.dlShiftTo(s, f);
      g.subTo(f, g);
      while (g[u] < --c) {
        g.subTo(f, g)
      }
    }
  }
  if (h != null) {
    g.drShiftTo(p, h);
    if (a != l) {
      BigInteger.ZERO.subTo(h, h)
    }
  }
  g.t = p;
  g.clamp();
  if (v > 0) {
    g.rShiftTo(v, g)
  }
  if (a < 0) {
    BigInteger.ZERO.subTo(g, g)
  }
}

function bnMod(b) {
  var c = nbi();
  this.abs().divRemTo(b, null, c);
  if (this.s < 0 && c.compareTo(BigInteger.ZERO) > 0) {
    b.subTo(c, c)
  }
  return c
}

function Classic(a) {
  this.m = a
}

function cConvert(a) {
  if (a.s < 0 || a.compareTo(this.m) >= 0) {
    return a.mod(this.m)
  } else {
    return a
  }
}

function cRevert(a) {
  return a
}

function cReduce(a) {
  a.divRemTo(this.m, null, a)
}

function cMulTo(a, c, b) {
  a.multiplyTo(c, b);
  this.reduce(b)
}

function cSqrTo(a, b) {
  a.squareTo(b);
  this.reduce(b)
}
Classic.prototype.convert = cConvert;
Classic.prototype.revert = cRevert;
Classic.prototype.reduce = cReduce;
Classic.prototype.mulTo = cMulTo;
Classic.prototype.sqrTo = cSqrTo;

function bnpInvDigit() {
  if (this.t < 1) {
    return 0
  }
  var a = this[0];
  if ((a & 1) == 0) {
    return 0
  }
  var b = a & 3;
  b = (b * (2 - (a & 15) * b)) & 15;
  b = (b * (2 - (a & 255) * b)) & 255;
  b = (b * (2 - (((a & 65535) * b) & 65535))) & 65535;
  b = (b * (2 - a * b % this.DV)) % this.DV;
  return (b > 0) ? this.DV - b : -b
}

function Montgomery(a) {
  this.m = a;
  this.mp = a.invDigit();
  this.mpl = this.mp & 32767;
  this.mph = this.mp >> 15;
  this.um = (1 << (a.DB - 15)) - 1;
  this.mt2 = 2 * a.t
}

function montConvert(a) {
  var b = nbi();
  a.abs().dlShiftTo(this.m.t, b);
  b.divRemTo(this.m, null, b);
  if (a.s < 0 && b.compareTo(BigInteger.ZERO) > 0) {
    this.m.subTo(b, b)
  }
  return b
}

function montRevert(a) {
  var b = nbi();
  a.copyTo(b);
  this.reduce(b);
  return b
}

function montReduce(a) {
  while (a.t <= this.mt2) {
    a[a.t++] = 0
  }
  for (var c = 0; c < this.m.t; ++c) {
    var b = a[c] & 32767;
    var d = (b * this.mpl + (((b * this.mph + (a[c] >> 15) * this.mpl) & this.um) << 15)) & a.DM;
    b = c + this.m.t;
    a[b] += this.m.am(0, d, a, c, 0, this.m.t);
    while (a[b] >= a.DV) {
      a[b] -= a.DV;
      a[++b]++
    }
  }
  a.clamp();
  a.drShiftTo(this.m.t, a);
  if (a.compareTo(this.m) >= 0) {
    a.subTo(this.m, a)
  }
}

function montSqrTo(a, b) {
  a.squareTo(b);
  this.reduce(b)
}

function montMulTo(a, c, b) {
  a.multiplyTo(c, b);
  this.reduce(b)
}
Montgomery.prototype.convert = montConvert;
Montgomery.prototype.revert = montRevert;
Montgomery.prototype.reduce = montReduce;
Montgomery.prototype.mulTo = montMulTo;
Montgomery.prototype.sqrTo = montSqrTo;

function bnpIsEven() {
  return ((this.t > 0) ? (this[0] & 1) : this.s) == 0
}

function bnpExp(h, j) {
  if (h > 4294967295 || h < 1) {
    return BigInteger.ONE
  }
  var f = nbi(),
    a = nbi(),
    d = j.convert(this),
    c = nbits(h) - 1;
  d.copyTo(f);
  while (--c >= 0) {
    j.sqrTo(f, a);
    if ((h & (1 << c)) > 0) {
      j.mulTo(a, d, f)
    } else {
      var b = f;
      f = a;
      a = b
    }
  }
  return j.revert(f)
}

function bnModPowInt(b, a) {
  var c;
  if (b < 256 || a.isEven()) {
    c = new Classic(a)
  } else {
    c = new Montgomery(a)
  }
  return this.exp(b, c)
}
BigInteger.prototype.copyTo = bnpCopyTo;
BigInteger.prototype.fromInt = bnpFromInt;
BigInteger.prototype.fromString = bnpFromString;
BigInteger.prototype.clamp = bnpClamp;
BigInteger.prototype.dlShiftTo = bnpDLShiftTo;
BigInteger.prototype.drShiftTo = bnpDRShiftTo;
BigInteger.prototype.lShiftTo = bnpLShiftTo;
BigInteger.prototype.rShiftTo = bnpRShiftTo;
BigInteger.prototype.subTo = bnpSubTo;
BigInteger.prototype.multiplyTo = bnpMultiplyTo;
BigInteger.prototype.squareTo = bnpSquareTo;
BigInteger.prototype.divRemTo = bnpDivRemTo;
BigInteger.prototype.invDigit = bnpInvDigit;
BigInteger.prototype.isEven = bnpIsEven;
BigInteger.prototype.exp = bnpExp;
BigInteger.prototype.toString = bnToString;
BigInteger.prototype.negate = bnNegate;
BigInteger.prototype.abs = bnAbs;
BigInteger.prototype.compareTo = bnCompareTo;
BigInteger.prototype.bitLength = bnBitLength;
BigInteger.prototype.mod = bnMod;
BigInteger.prototype.modPowInt = bnModPowInt;
BigInteger.ZERO = nbv(0);
BigInteger.ONE = nbv(1);

//prng4.js

function Arcfour() {
  this.i = 0;
  this.j = 0;
  this.S = new Array()
}

function ARC4init(d) {
  var c, a, b;
  for (c = 0; c < 256; ++c) {
    this.S[c] = c
  }
  a = 0;
  for (c = 0; c < 256; ++c) {
    a = (a + this.S[c] + d[c % d.length]) & 255;
    b = this.S[c];
    this.S[c] = this.S[a];
    this.S[a] = b
  }
  this.i = 0;
  this.j = 0
}

function ARC4next() {
  var a;
  this.i = (this.i + 1) & 255;
  this.j = (this.j + this.S[this.i]) & 255;
  a = this.S[this.i];
  this.S[this.i] = this.S[this.j];
  this.S[this.j] = a;
  return this.S[(a + this.S[this.i]) & 255]
}
Arcfour.prototype.init = ARC4init;
Arcfour.prototype.next = ARC4next;

function prng_newstate() {
  return new Arcfour()
}
var rng_psize = 256;

//rng.js

var navigator = navigator || window.navigator;

var rng_state;
var rng_pool;
var rng_pptr;

function rng_seed_int(a) {
  rng_pool[rng_pptr++] ^= a & 255;
  rng_pool[rng_pptr++] ^= (a >> 8) & 255;
  rng_pool[rng_pptr++] ^= (a >> 16) & 255;
  rng_pool[rng_pptr++] ^= (a >> 24) & 255;
  if (rng_pptr >= rng_psize) {
    rng_pptr -= rng_psize
  }
}

function rng_seed_time() {
  rng_seed_int(new Date().getTime())
}
if (rng_pool == null) {
  rng_pool = new Array();
  rng_pptr = 0;
  var t;
  while (rng_pptr < rng_psize) {
    t = Math.floor(65536 * Math.random());
    rng_pool[rng_pptr++] = t >>> 8;
    rng_pool[rng_pptr++] = t & 255
  }
  rng_pptr = 0;
  rng_seed_time()
}

function rng_get_byte() {
  if (rng_state == null) {
    rng_seed_time();
    rng_state = prng_newstate();
    rng_state.init(rng_pool);
    for (rng_pptr = 0; rng_pptr < rng_pool.length; ++rng_pptr) {
      rng_pool[rng_pptr] = 0
    }
    rng_pptr = 0
  }
  return rng_state.next()
}

function rng_get_bytes(b) {
  var a;
  for (a = 0; a < b.length; ++a) {
    b[a] = rng_get_byte()
  }
}

function SecureRandom() { }
SecureRandom.prototype.nextBytes = rng_get_bytes;

//rsa.js

function parseBigInt(b, a) {
  return new BigInteger(b, a)
}

function linebrk(c, d) {
  var a = "";
  var b = 0;
  while (b + d < c.length) {
    a += c.substring(b, b + d) + "\n";
    b += d
  }
  return a + c.substring(b, c.length)
}

function byte2Hex(a) {
  if (a < 16) {
    return "0" + a.toString(16)
  } else {
    return a.toString(16)
  }
}

function pkcs1pad2(f, h) {
  if (h < f.length + 11) {
    alert("Message too long for RSA");
    return null
  }
  var g = new Array();
  var d = f.length - 1;
  while (d >= 1 && h > 0) {
    var c = f[d--];
    var e = f[d--];
    g[--h] = (intAt(e, 0) << 4) + intAt(c, 0)
  }
  g[--h] = 0;
  var b = new SecureRandom();
  var a = new Array();
  while (h > 2) {
    a[0] = 0;
    while (a[0] == 0) {
      b.nextBytes(a)
    }
    g[--h] = a[0]
  }
  g[--h] = 2;
  g[--h] = 0;
  return new BigInteger(g)
}

function RSAKey() {
  this.n = null;
  this.e = 0;
  this.d = null;
  this.p = null;
  this.q = null;
  this.dmp1 = null;
  this.dmq1 = null;
  this.coeff = null
}

function RSASetPublic(b, a) {
  if (b != null && a != null && b.length > 0 && a.length > 0) {
    this.n = parseBigInt(b, 16);
    this.e = parseInt(a, 16)
  } else {
    alert("Invalid RSA public key")
  }
}

function RSADoPublic(a) {
  return a.modPowInt(this.e, this.n)
}

function RSAEncrypt(d) {
  var a = pkcs1pad2(d, (this.n.bitLength() + 7) >> 3);
  if (a == null) {
    return null
  }
  var e = this.doPublic(a);
  if (e == null) {
    return null
  }
  var b = e.toString(16);
  if ((b.length & 1) == 0) {
    return b
  } else {
    return "0" + b
  }
}
RSAKey.prototype.doPublic = RSADoPublic;
RSAKey.prototype.setPublic = RSASetPublic;
RSAKey.prototype.encrypt = RSAEncrypt;

//jsbn2.js (used for forge only)

function bnClone() {
  var a = nbi();
  this.copyTo(a);
  return a
}

function bnIntValue() {
  if (this.s < 0) {
    if (this.t == 1) {
      return this[0] - this.DV
    } else {
      if (this.t == 0) {
        return -1
      }
    }
  } else {
    if (this.t == 1) {
      return this[0]
    } else {
      if (this.t == 0) {
        return 0
      }
    }
  }
  return ((this[1] & ((1 << (32 - this.DB)) - 1)) << this.DB) | this[0]
}

function bnByteValue() {
  return (this.t == 0) ? this.s : (this[0] << 24) >> 24
}

function bnShortValue() {
  return (this.t == 0) ? this.s : (this[0] << 16) >> 16
}

function bnpChunkSize(a) {
  return Math.floor(Math.LN2 * this.DB / Math.log(a))
}

function bnSigNum() {
  if (this.s < 0) {
    return -1
  } else {
    if (this.t <= 0 || (this.t == 1 && this[0] <= 0)) {
      return 0
    } else {
      return 1
    }
  }
}

function bnpToRadix(c) {
  if (c == null) {
    c = 10
  }
  if (this.signum() == 0 || c < 2 || c > 36) {
    return "0"
  }
  var f = this.chunkSize(c);
  var e = Math.pow(c, f);
  var i = nbv(e),
    j = nbi(),
    h = nbi(),
    g = "";
  this.divRemTo(i, j, h);
  while (j.signum() > 0) {
    g = (e + h.intValue()).toString(c).substr(1) + g;
    j.divRemTo(i, j, h)
  }
  return h.intValue().toString(c) + g
}

function bnpFromRadix(m, h) {
  this.fromInt(0);
  if (h == null) {
    h = 10
  }
  var f = this.chunkSize(h);
  var g = Math.pow(h, f),
    e = false,
    a = 0,
    l = 0;
  for (var c = 0; c < m.length; ++c) {
    var k = intAt(m, c);
    if (k < 0) {
      if (m.charAt(c) == "-" && this.signum() == 0) {
        e = true
      }
      continue
    }
    l = h * l + k;
    if (++a >= f) {
      this.dMultiply(g);
      this.dAddOffset(l, 0);
      a = 0;
      l = 0
    }
  }
  if (a > 0) {
    this.dMultiply(Math.pow(h, a));
    this.dAddOffset(l, 0)
  }
  if (e) {
    BigInteger.ZERO.subTo(this, this)
  }
}

function bnpFromNumber(f, e, h) {
  if ("number" == typeof e) {
    if (f < 2) {
      this.fromInt(1)
    } else {
      this.fromNumber(f, h);
      if (!this.testBit(f - 1)) {
        this.bitwiseTo(BigInteger.ONE.shiftLeft(f - 1), op_or, this)
      }
      if (this.isEven()) {
        this.dAddOffset(1, 0)
      }
      while (!this.isProbablePrime(e)) {
        this.dAddOffset(2, 0);
        if (this.bitLength() > f) {
          this.subTo(BigInteger.ONE.shiftLeft(f - 1), this)
        }
      }
    }
  } else {
    var d = new Array(),
      g = f & 7;
    d.length = (f >> 3) + 1;
    e.nextBytes(d);
    if (g > 0) {
      d[0] &= ((1 << g) - 1)
    } else {
      d[0] = 0
    }
    this.fromString(d, 256)
  }
}

function bnToByteArray() {
  var b = this.t,
    c = new Array();
  c[0] = this.s;
  var e = this.DB - (b * this.DB) % 8,
    f, a = 0;
  if (b-- > 0) {
    if (e < this.DB && (f = this[b] >> e) != (this.s & this.DM) >> e) {
      c[a++] = f | (this.s << (this.DB - e))
    }
    while (b >= 0) {
      if (e < 8) {
        f = (this[b] & ((1 << e) - 1)) << (8 - e);
        f |= this[--b] >> (e += this.DB - 8)
      } else {
        f = (this[b] >> (e -= 8)) & 255;
        if (e <= 0) {
          e += this.DB;
          --b
        }
      }
      if ((f & 128) != 0) {
        f |= -256
      }
      if (a == 0 && (this.s & 128) != (f & 128)) {
        ++a
      }
      if (a > 0 || f != this.s) {
        c[a++] = f
      }
    }
  }
  return c
}

function bnEquals(b) {
  return (this.compareTo(b) == 0)
}

function bnMin(b) {
  return (this.compareTo(b) < 0) ? this : b
}

function bnMax(b) {
  return (this.compareTo(b) > 0) ? this : b
}

function bnpBitwiseTo(c, h, e) {
  var d, g, b = Math.min(c.t, this.t);
  for (d = 0; d < b; ++d) {
    e[d] = h(this[d], c[d])
  }
  if (c.t < this.t) {
    g = c.s & this.DM;
    for (d = b; d < this.t; ++d) {
      e[d] = h(this[d], g)
    }
    e.t = this.t
  } else {
    g = this.s & this.DM;
    for (d = b; d < c.t; ++d) {
      e[d] = h(g, c[d])
    }
    e.t = c.t
  }
  e.s = h(this.s, c.s);
  e.clamp()
}

function op_and(a, b) {
  return a & b
}

function bnAnd(b) {
  var c = nbi();
  this.bitwiseTo(b, op_and, c);
  return c
}

function op_or(a, b) {
  return a | b
}

function bnOr(b) {
  var c = nbi();
  this.bitwiseTo(b, op_or, c);
  return c
}

function op_xor(a, b) {
  return a ^ b
}

function bnXor(b) {
  var c = nbi();
  this.bitwiseTo(b, op_xor, c);
  return c
}

function op_andnot(a, b) {
  return a & ~b
}

function bnAndNot(b) {
  var c = nbi();
  this.bitwiseTo(b, op_andnot, c);
  return c
}

function bnNot() {
  var b = nbi();
  for (var a = 0; a < this.t; ++a) {
    b[a] = this.DM & ~this[a]
  }
  b.t = this.t;
  b.s = ~this.s;
  return b
}

function bnShiftLeft(b) {
  var a = nbi();
  if (b < 0) {
    this.rShiftTo(-b, a)
  } else {
    this.lShiftTo(b, a)
  }
  return a
}

function bnShiftRight(b) {
  var a = nbi();
  if (b < 0) {
    this.lShiftTo(-b, a)
  } else {
    this.rShiftTo(b, a)
  }
  return a
}

function lbit(a) {
  if (a == 0) {
    return -1
  }
  var b = 0;
  if ((a & 65535) == 0) {
    a >>= 16;
    b += 16
  }
  if ((a & 255) == 0) {
    a >>= 8;
    b += 8
  }
  if ((a & 15) == 0) {
    a >>= 4;
    b += 4
  }
  if ((a & 3) == 0) {
    a >>= 2;
    b += 2
  }
  if ((a & 1) == 0) {
    ++b
  }
  return b
}

function bnGetLowestSetBit() {
  for (var a = 0; a < this.t; ++a) {
    if (this[a] != 0) {
      return a * this.DB + lbit(this[a])
    }
  }
  if (this.s < 0) {
    return this.t * this.DB
  }
  return -1
}

function cbit(a) {
  var b = 0;
  while (a != 0) {
    a &= a - 1;
    ++b
  }
  return b
}

function bnBitCount() {
  var c = 0,
    a = this.s & this.DM;
  for (var b = 0; b < this.t; ++b) {
    c += cbit(this[b] ^ a)
  }
  return c
}

function bnTestBit(b) {
  var a = Math.floor(b / this.DB);
  if (a >= this.t) {
    return (this.s != 0)
  }
  return ((this[a] & (1 << (b % this.DB))) != 0)
}

function bnpChangeBit(c, b) {
  var a = BigInteger.ONE.shiftLeft(c);
  this.bitwiseTo(a, b, a);
  return a
}

function bnSetBit(a) {
  return this.changeBit(a, op_or)
}

function bnClearBit(a) {
  return this.changeBit(a, op_andnot)
}

function bnFlipBit(a) {
  return this.changeBit(a, op_xor)
}

function bnpAddTo(d, f) {
  var e = 0,
    g = 0,
    b = Math.min(d.t, this.t);
  while (e < b) {
    g += this[e] + d[e];
    f[e++] = g & this.DM;
    g >>= this.DB
  }
  if (d.t < this.t) {
    g += d.s;
    while (e < this.t) {
      g += this[e];
      f[e++] = g & this.DM;
      g >>= this.DB
    }
    g += this.s
  } else {
    g += this.s;
    while (e < d.t) {
      g += d[e];
      f[e++] = g & this.DM;
      g >>= this.DB
    }
    g += d.s
  }
  f.s = (g < 0) ? -1 : 0;
  if (g > 0) {
    f[e++] = g
  } else {
    if (g < -1) {
      f[e++] = this.DV + g
    }
  }
  f.t = e;
  f.clamp()
}

function bnAdd(b) {
  var c = nbi();
  this.addTo(b, c);
  return c
}

function bnSubtract(b) {
  var c = nbi();
  this.subTo(b, c);
  return c
}

function bnMultiply(b) {
  var c = nbi();
  this.multiplyTo(b, c);
  return c
}

function bnSquare() {
  var a = nbi();
  this.squareTo(a);
  return a
}

function bnDivide(b) {
  var c = nbi();
  this.divRemTo(b, c, null);
  return c
}

function bnRemainder(b) {
  var c = nbi();
  this.divRemTo(b, null, c);
  return c
}

function bnDivideAndRemainder(b) {
  var d = nbi(),
    c = nbi();
  this.divRemTo(b, d, c);
  return new Array(d, c)
}

function bnpDMultiply(a) {
  this[this.t] = this.am(0, a - 1, this, 0, 0, this.t);
  ++this.t;
  this.clamp()
}

function bnpDAddOffset(b, a) {
  if (b == 0) {
    return
  }
  while (this.t <= a) {
    this[this.t++] = 0
  }
  this[a] += b;
  while (this[a] >= this.DV) {
    this[a] -= this.DV;
    if (++a >= this.t) {
      this[this.t++] = 0
    } ++this[a]
  }
}

function NullExp() { }

function nNop(a) {
  return a
}

function nMulTo(a, c, b) {
  a.multiplyTo(c, b)
}

function nSqrTo(a, b) {
  a.squareTo(b)
}
NullExp.prototype.convert = nNop;
NullExp.prototype.revert = nNop;
NullExp.prototype.mulTo = nMulTo;
NullExp.prototype.sqrTo = nSqrTo;

function bnPow(a) {
  return this.exp(a, new NullExp())
}

function bnpMultiplyLowerTo(b, f, e) {
  var d = Math.min(this.t + b.t, f);
  e.s = 0;
  e.t = d;
  while (d > 0) {
    e[--d] = 0
  }
  var c;
  for (c = e.t - this.t; d < c; ++d) {
    e[d + this.t] = this.am(0, b[d], e, d, 0, this.t)
  }
  for (c = Math.min(b.t, f); d < c; ++d) {
    this.am(0, b[d], e, d, 0, f - d)
  }
  e.clamp()
}

function bnpMultiplyUpperTo(b, e, d) {
  --e;
  var c = d.t = this.t + b.t - e;
  d.s = 0;
  while (--c >= 0) {
    d[c] = 0
  }
  for (c = Math.max(e - this.t, 0); c < b.t; ++c) {
    d[this.t + c - e] = this.am(e - c, b[c], d, 0, 0, this.t + c - e)
  }
  d.clamp();
  d.drShiftTo(1, d)
}

function Barrett(a) {
  this.r2 = nbi();
  this.q3 = nbi();
  BigInteger.ONE.dlShiftTo(2 * a.t, this.r2);
  this.mu = this.r2.divide(a);
  this.m = a
}

function barrettConvert(a) {
  if (a.s < 0 || a.t > 2 * this.m.t) {
    return a.mod(this.m)
  } else {
    if (a.compareTo(this.m) < 0) {
      return a
    } else {
      var b = nbi();
      a.copyTo(b);
      this.reduce(b);
      return b
    }
  }
}

function barrettRevert(a) {
  return a
}

function barrettReduce(a) {
  a.drShiftTo(this.m.t - 1, this.r2);
  if (a.t > this.m.t + 1) {
    a.t = this.m.t + 1;
    a.clamp()
  }
  this.mu.multiplyUpperTo(this.r2, this.m.t + 1, this.q3);
  this.m.multiplyLowerTo(this.q3, this.m.t + 1, this.r2);
  while (a.compareTo(this.r2) < 0) {
    a.dAddOffset(1, this.m.t + 1)
  }
  a.subTo(this.r2, a);
  while (a.compareTo(this.m) >= 0) {
    a.subTo(this.m, a)
  }
}

function barrettSqrTo(a, b) {
  a.squareTo(b);
  this.reduce(b)
}

function barrettMulTo(a, c, b) {
  a.multiplyTo(c, b);
  this.reduce(b)
}
Barrett.prototype.convert = barrettConvert;
Barrett.prototype.revert = barrettRevert;
Barrett.prototype.reduce = barrettReduce;
Barrett.prototype.mulTo = barrettMulTo;
Barrett.prototype.sqrTo = barrettSqrTo;

function bnModPow(q, f) {
  var o = q.bitLength(),
    h, b = nbv(1),
    v;
  if (o <= 0) {
    return b
  } else {
    if (o < 18) {
      h = 1
    } else {
      if (o < 48) {
        h = 3
      } else {
        if (o < 144) {
          h = 4
        } else {
          if (o < 768) {
            h = 5
          } else {
            h = 6
          }
        }
      }
    }
  }
  if (o < 8) {
    v = new Classic(f)
  } else {
    if (f.isEven()) {
      v = new Barrett(f)
    } else {
      v = new Montgomery(f)
    }
  }
  var p = new Array(),
    d = 3,
    s = h - 1,
    a = (1 << h) - 1;
  p[1] = v.convert(this);
  if (h > 1) {
    var A = nbi();
    v.sqrTo(p[1], A);
    while (d <= a) {
      p[d] = nbi();
      v.mulTo(A, p[d - 2], p[d]);
      d += 2
    }
  }
  var l = q.t - 1,
    x, u = true,
    c = nbi(),
    y;
  o = nbits(q[l]) - 1;
  while (l >= 0) {
    if (o >= s) {
      x = (q[l] >> (o - s)) & a
    } else {
      x = (q[l] & ((1 << (o + 1)) - 1)) << (s - o);
      if (l > 0) {
        x |= q[l - 1] >> (this.DB + o - s)
      }
    }
    d = h;
    while ((x & 1) == 0) {
      x >>= 1;
      --d
    }
    if ((o -= d) < 0) {
      o += this.DB;
      --l
    }
    if (u) {
      p[x].copyTo(b);
      u = false
    } else {
      while (d > 1) {
        v.sqrTo(b, c);
        v.sqrTo(c, b);
        d -= 2
      }
      if (d > 0) {
        v.sqrTo(b, c)
      } else {
        y = b;
        b = c;
        c = y
      }
      v.mulTo(c, p[x], b)
    }
    while (l >= 0 && (q[l] & (1 << o)) == 0) {
      v.sqrTo(b, c);
      y = b;
      b = c;
      c = y;
      if (--o < 0) {
        o = this.DB - 1;
        --l
      }
    }
  }
  return v.revert(b)
}

function bnGCD(c) {
  var b = (this.s < 0) ? this.negate() : this.clone();
  var h = (c.s < 0) ? c.negate() : c.clone();
  if (b.compareTo(h) < 0) {
    var e = b;
    b = h;
    h = e
  }
  var d = b.getLowestSetBit(),
    f = h.getLowestSetBit();
  if (f < 0) {
    return b
  }
  if (d < f) {
    f = d
  }
  if (f > 0) {
    b.rShiftTo(f, b);
    h.rShiftTo(f, h)
  }
  while (b.signum() > 0) {
    if ((d = b.getLowestSetBit()) > 0) {
      b.rShiftTo(d, b)
    }
    if ((d = h.getLowestSetBit()) > 0) {
      h.rShiftTo(d, h)
    }
    if (b.compareTo(h) >= 0) {
      b.subTo(h, b);
      b.rShiftTo(1, b)
    } else {
      h.subTo(b, h);
      h.rShiftTo(1, h)
    }
  }
  if (f > 0) {
    h.lShiftTo(f, h)
  }
  return h
}

function bnpModInt(e) {
  if (e <= 0) {
    return 0
  }
  var c = this.DV % e,
    b = (this.s < 0) ? e - 1 : 0;
  if (this.t > 0) {
    if (c == 0) {
      b = this[0] % e
    } else {
      for (var a = this.t - 1; a >= 0; --a) {
        b = (c * b + this[a]) % e
      }
    }
  }
  return b
}

function bnModInverse(f) {
  var j = f.isEven();
  if ((this.isEven() && j) || f.signum() == 0) {
    return BigInteger.ZERO
  }
  var i = f.clone(),
    h = this.clone();
  var g = nbv(1),
    e = nbv(0),
    l = nbv(0),
    k = nbv(1);
  while (i.signum() != 0) {
    while (i.isEven()) {
      i.rShiftTo(1, i);
      if (j) {
        if (!g.isEven() || !e.isEven()) {
          g.addTo(this, g);
          e.subTo(f, e)
        }
        g.rShiftTo(1, g)
      } else {
        if (!e.isEven()) {
          e.subTo(f, e)
        }
      }
      e.rShiftTo(1, e)
    }
    while (h.isEven()) {
      h.rShiftTo(1, h);
      if (j) {
        if (!l.isEven() || !k.isEven()) {
          l.addTo(this, l);
          k.subTo(f, k)
        }
        l.rShiftTo(1, l)
      } else {
        if (!k.isEven()) {
          k.subTo(f, k)
        }
      }
      k.rShiftTo(1, k)
    }
    if (i.compareTo(h) >= 0) {
      i.subTo(h, i);
      if (j) {
        g.subTo(l, g)
      }
      e.subTo(k, e)
    } else {
      h.subTo(i, h);
      if (j) {
        l.subTo(g, l)
      }
      k.subTo(e, k)
    }
  }
  if (h.compareTo(BigInteger.ONE) != 0) {
    return BigInteger.ZERO
  }
  if (k.compareTo(f) >= 0) {
    return k.subtract(f)
  }
  if (k.signum() < 0) {
    k.addTo(f, k)
  } else {
    return k
  }
  if (k.signum() < 0) {
    return k.add(f)
  } else {
    return k
  }
}
var lowprimes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113, 127, 131, 137, 139, 149, 151, 157, 163, 167, 173, 179, 181, 191, 193, 197, 199, 211, 223, 227, 229, 233, 239, 241, 251, 257, 263, 269, 271, 277, 281, 283, 293, 307, 311, 313, 317, 331, 337, 347, 349, 353, 359, 367, 373, 379, 383, 389, 397, 401, 409, 419, 421, 431, 433, 439, 443, 449, 457, 461, 463, 467, 479, 487, 491, 499, 503, 509, 521, 523, 541, 547, 557, 563, 569, 571, 577, 587, 593, 599, 601, 607, 613, 617, 619, 631, 641, 643, 647, 653, 659, 661, 673, 677, 683, 691, 701, 709, 719, 727, 733, 739, 743, 751, 757, 761, 769, 773, 787, 797, 809, 811, 821, 823, 827, 829, 839, 853, 857, 859, 863, 877, 881, 883, 887, 907, 911, 919, 929, 937, 941, 947, 953, 967, 971, 977, 983, 991, 997];
var lplim = (1 << 26) / lowprimes[lowprimes.length - 1];

function bnIsProbablePrime(e) {
  var d, b = this.abs();
  if (b.t == 1 && b[0] <= lowprimes[lowprimes.length - 1]) {
    for (d = 0; d < lowprimes.length; ++d) {
      if (b[0] == lowprimes[d]) {
        return true
      }
    }
    return false
  }
  if (b.isEven()) {
    return false
  }
  d = 1;
  while (d < lowprimes.length) {
    var a = lowprimes[d],
      c = d + 1;
    while (c < lowprimes.length && a < lplim) {
      a *= lowprimes[c++]
    }
    a = b.modInt(a);
    while (d < c) {
      if (a % lowprimes[d++] == 0) {
        return false
      }
    }
  }
  return b.millerRabin(e)
}

function bnpMillerRabin(f) {
  var g = this.subtract(BigInteger.ONE);
  var c = g.getLowestSetBit();
  if (c <= 0) {
    return false
  }
  var h = g.shiftRight(c);
  f = (f + 1) >> 1;
  if (f > lowprimes.length) {
    f = lowprimes.length
  }
  var b = nbi();
  for (var e = 0; e < f; ++e) {
    b.fromInt(lowprimes[Math.floor(Math.random() * lowprimes.length)]);
    var l = b.modPow(h, this);
    if (l.compareTo(BigInteger.ONE) != 0 && l.compareTo(g) != 0) {
      var d = 1;
      while (d++ < c && l.compareTo(g) != 0) {
        l = l.modPowInt(2, this);
        if (l.compareTo(BigInteger.ONE) == 0) {
          return false
        }
      }
      if (l.compareTo(g) != 0) {
        return false
      }
    }
  }
  return true
}
BigInteger.prototype.chunkSize = bnpChunkSize;
BigInteger.prototype.toRadix = bnpToRadix;
BigInteger.prototype.fromRadix = bnpFromRadix;
BigInteger.prototype.fromNumber = bnpFromNumber;
BigInteger.prototype.bitwiseTo = bnpBitwiseTo;
BigInteger.prototype.changeBit = bnpChangeBit;
BigInteger.prototype.addTo = bnpAddTo;
BigInteger.prototype.dMultiply = bnpDMultiply;
BigInteger.prototype.dAddOffset = bnpDAddOffset;
BigInteger.prototype.multiplyLowerTo = bnpMultiplyLowerTo;
BigInteger.prototype.multiplyUpperTo = bnpMultiplyUpperTo;
BigInteger.prototype.modInt = bnpModInt;
BigInteger.prototype.millerRabin = bnpMillerRabin;
BigInteger.prototype.clone = bnClone;
BigInteger.prototype.intValue = bnIntValue;
BigInteger.prototype.byteValue = bnByteValue;
BigInteger.prototype.shortValue = bnShortValue;
BigInteger.prototype.signum = bnSigNum;
BigInteger.prototype.toByteArray = bnToByteArray;
BigInteger.prototype.equals = bnEquals;
BigInteger.prototype.min = bnMin;
BigInteger.prototype.max = bnMax;
BigInteger.prototype.and = bnAnd;
BigInteger.prototype.or = bnOr;
BigInteger.prototype.xor = bnXor;
BigInteger.prototype.andNot = bnAndNot;
BigInteger.prototype.not = bnNot;
BigInteger.prototype.shiftLeft = bnShiftLeft;
BigInteger.prototype.shiftRight = bnShiftRight;
BigInteger.prototype.getLowestSetBit = bnGetLowestSetBit;
BigInteger.prototype.bitCount = bnBitCount;
BigInteger.prototype.testBit = bnTestBit;
BigInteger.prototype.setBit = bnSetBit;
BigInteger.prototype.clearBit = bnClearBit;
BigInteger.prototype.flipBit = bnFlipBit;
BigInteger.prototype.add = bnAdd;
BigInteger.prototype.subtract = bnSubtract;
BigInteger.prototype.multiply = bnMultiply;
BigInteger.prototype.divide = bnDivide;
BigInteger.prototype.remainder = bnRemainder;
BigInteger.prototype.divideAndRemainder = bnDivideAndRemainder;
BigInteger.prototype.modPow = bnModPow;
BigInteger.prototype.modInverse = bnModInverse;
BigInteger.prototype.pow = bnPow;
BigInteger.prototype.gcd = bnGCD;
BigInteger.prototype.isProbablePrime = bnIsProbablePrime;
BigInteger.prototype.square = bnSquare;


/*var dhprime=new BigInteger('FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE649286651ECE65381FFFFFFFFFFFFFFFF',16);
var dhg=new BigInteger('02',16);
var secretX=new BigInteger('04',16);
alert(dhg.modPow(secretX,dhprime).toString(16));*/

/*function discrete_exp(t,u,n) {   // args are base, exponent, modulus
// computes s = (t ^ u) mod n
// (see Bruce Schneier's book, _Applied Cryptography_ p. 244)
   var s = 1;
   while (u) { if (u&1) {s = (s*t) % n}; u >>= 1; t = (t*t)%n; };
   return s;
}
*/

//prng.js (forge)

/**
 * A javascript implementation of a cryptographically-secure
 * Pseudo Random Number Generator (PRNG). The Fortuna algorithm is mostly
 * followed here. SHA-1 is used instead of SHA-256.
 *
 * @author Dave Longley
 *
 * Copyright (c) 2010-2012 Digital Bazaar, Inc.
 */
(function () {
  var a = forge;
  a.prng = {}; /*if(typeof(window)!=="undefined"){var a=window.forge=window.forge||{};a.prng={}}else{if(typeof(module)!=="undefined"&&module.exports){var a={md:require("./md"),util:require("./util")};a.md.sha1.create();module.exports=a.prng={}}}*/;
  var b = a.prng;
  b.create = function (g) {
    var c = {
      plugin: g,
      key: null,
      seed: null,
      time: null,
      reseeds: 0,
      generated: 0
    };
    var h = g.md;
    var f = new Array(32);
    for (var e = 0; e < 32; ++e) {
      f[e] = h.create()
    }
    c.pools = f;
    c.pool = 0;
    c.generate = function (o) {
      if (c.key === null) {
        d()
      }
      var k = c.plugin.cipher;
      var j = c.plugin.increment;
      var p = c.plugin.formatKey;
      var n = c.plugin.formatSeed;
      var i = a.util.createBuffer();
      while (i.length() < o) {
        var l = k(c.key, c.seed);
        c.generated += l.length;
        i.putBytes(l);
        c.key = p(k(c.key, j(c.seed)));
        c.seed = n(k(c.key, c.seed));
        if (c.generated >= 1048576) {
          var m = +new Date();
          if (m - c.time < 100) {
            d()
          }
        }
      }
      return i.getBytes(o)
    };

    function d() {
      if (c.pools[0].messageLength < 32) {
        var t = (32 - c.pools[0].messageLength) << 5;
        var s = "";
        var j, q, n;
        var o = Math.floor(Math.random() * 65535);
        while (s.length < t) {
          q = 16807 * (o & 65535);
          j = 16807 * (o >> 16);
          q += (j & 32767) << 16;
          q += j >> 15;
          q = (q & 2147483647) + (q >> 31);
          o = q & 4294967295;
          for (var m = 0; m < 3; ++m) {
            n = o >>> (m << 3);
            n ^= Math.floor(Math.random() * 255);
            s += String.fromCharCode(n & 255)
          }
        }
        c.collect(s)
      } else {
        var r = a.md.sha1.create();
        r.update(c.pools[0].digest().getBytes());
        c.pools[0].start();
        var l = 1;
        for (var m = 1; m < 32; ++m) {
          l = (l == 31) ? 2147483648 : (l << 2);
          if (l % c.reseeds === 0) {
            r.update(c.pools[m].digest().getBytes());
            c.pools[m].start()
          }
        }
        var p = r.digest().getBytes();
        r.start();
        r.update(p);
        var u = r.digest().getBytes();
        c.key = c.plugin.formatKey(p);
        c.seed = c.plugin.formatSeed(u);
        ++c.reseeds;
        c.generated = 0;
        c.time = +new Date()
      }
    }
    c.collect = function (j) {
      var m = j.length;
      for (var l = 0; l < m; ++l) {
        c.pools[c.pool].update(j.substr(l, 1));
        c.pool = (c.pool === 31) ? 0 : c.pool + 1
      }
      if (c.pools[0].messageLength >= 32) {
        var k = +new Date();
        if (c.time === null || (k - c.time < 100)) {
          d()
        }
      }
    };
    c.collectInt = function (k, l) {
      var j = "";
      do {
        l -= 8;
        j += String.fromCharCode((k >> l) & 255)
      } while (l > 0);
      c.collect(j)
    };
    return c
  }
})();

//random.js (forge)

/**
 * An API for getting cryptographically-secure random bytes. The bytes are
 * generated using the Fortuna algorithm devised by Bruce Schneier and
 * Niels Ferguson.
 *
 * Getting strong random bytes is not yet easy to do in javascript. The only
 * truish random entropy that can be collected is from the mouse, keyboard, or
 * from timing with respect to page loads, etc. This generator makes a poor
 * attempt at providing random bytes when those sources haven't yet provided
 * enough entropy to initially seed or to reseed the PRNG.
 *
 * @author Dave Longley
 *
 * Copyright (c) 2009-2012 Digital Bazaar, Inc.
 */
(function (d) {
  var i = forge;
  i.random = {}; /*if(typeof(window)!=="undefined"){var i=window.forge=window.forge||{};i.random={}}else{if(typeof(module)!=="undefined"&&module.exports){var i={aes:require("./aes"),md:require("./md"),prng:require("./prng"),util:require("./util")};module.exports=i.random={}}}*/;
  var h = {};
  var f = new Array(4);
  var c = i.util.createBuffer();
  h.formatKey = function (k) {
    var e = i.util.createBuffer(k);
    k = new Array(4);
    k[0] = e.getInt32();
    k[1] = e.getInt32();
    k[2] = e.getInt32();
    k[3] = e.getInt32();
    return i.aes._expandKey(k, false)
  };
  h.formatSeed = function (e) {
    var tmp = i.util.createBuffer(e);
    e = new Array(4);
    e[0] = tmp.getInt32();
    e[1] = tmp.getInt32();
    e[2] = tmp.getInt32();
    e[3] = tmp.getInt32();
    return e
  };
  h.cipher = function (k, e) {
    i.aes._updateBlock(k, e, f, false);
    c.putInt32(f[0]);
    c.putInt32(f[1]);
    c.putInt32(f[2]);
    c.putInt32(f[3]);
    return c.getBytes()
  };
  h.increment = function (e) {
    ++e[3];
    return e
  };
  h.md = i.md.sha1;
  var b = i.prng.create(h);
  b.collectInt(+new Date(), 32);
  if (typeof (navigator) !== "undefined") {
    var a = "";
    for (var j in navigator) {
      try {
        if (typeof (navigator[j]) == "string") {
          a += navigator[j]
        }
      } catch (g) { }
    }
    b.collect(a);
    a = null
  }
  if (d) {
    d().mousemove(function (k) {
      b.collectInt(k.clientX, 16);
      b.collectInt(k.clientY, 16)
    });
    d().keypress(function (k) {
      b.collectInt(k.charCode, 8)
    })
  }
  i.random.getBytes = function (e) {
    return b.generate(e)
  }
})(typeof (jQuery) !== "undefined" ? jQuery : null);

//oid.js (forge)

/**
 * Object IDs for ASN.1.
 *
 * @author Dave Longley
 *
 * Copyright (c) 2010-2012 Digital Bazaar, Inc.
 */
(function () {
  var a = {};
  var b = forge; /*if(typeof(window)!=="undefined"){var b=window.forge=window.forge||{}}else{if(typeof(module)!=="undefined"&&module.exports){var b={};module.exports=a}}*/;
  b.pki = b.pki || {};
  b.pki.oids = a;
  a["1.2.840.113549.1.1.1"] = "rsaEncryption";
  a.rsaEncryption = "1.2.840.113549.1.1.1";
  a["1.2.840.113549.1.1.4"] = "md5withRSAEncryption";
  a.md5withRSAEncryption = "1.2.840.113549.1.1.4";
  a["1.2.840.113549.1.1.5"] = "sha1withRSAEncryption";
  a.sha1withRSAEncryption = "1.2.840.113549.1.1.5";
  a["1.2.840.113549.1.1.7"] = "RSAES-OAEP";
  a["RSAES-OAEP"] = "1.2.840.113549.1.1.7";
  a["1.2.840.113549.1.1.8"] = "mgf1";
  a.mgf1 = "1.2.840.113549.1.1.8";
  a["1.2.840.113549.1.1.9"] = "pSpecified";
  a.pSpecified = "1.2.840.113549.1.1.9";
  a["1.2.840.113549.1.1.10"] = "RSASSA-PSS";
  a["RSASSA-PSS"] = "1.2.840.113549.1.1.10";
  a["1.2.840.113549.1.1.11"] = "sha256WithRSAEncryption";
  a.sha256WithRSAEncryption = "1.2.840.113549.1.1.11";
  a["1.2.840.113549.1.1.12"] = "sha384WithRSAEncryption";
  a.sha384WithRSAEncryption = "1.2.840.113549.1.1.12";
  a["1.2.840.113549.1.1.13"] = "sha512WithRSAEncryption";
  a.sha512WithRSAEncryption = "1.2.840.113549.1.1.13";
  a["1.3.14.3.2.26"] = "sha1";
  a.sha1 = "1.3.14.3.2.26";
  a["2.16.840.1.101.3.4.2.1"] = "sha256";
  a.sha256 = "2.16.840.1.101.3.4.2.1";
  a["2.16.840.1.101.3.4.2.2"] = "sha384";
  a.sha384 = "2.16.840.1.101.3.4.2.2";
  a["2.16.840.1.101.3.4.2.3"] = "sha512";
  a.sha512 = "2.16.840.1.101.3.4.2.3";
  a["1.2.840.113549.2.5"] = "md5";
  a.md5 = "1.2.840.113549.2.5";
  a["1.2.840.113549.1.7.1"] = "data";
  a.data = "1.2.840.113549.1.7.1";
  a["1.2.840.113549.1.7.2"] = "signedData";
  a.signedData = "1.2.840.113549.1.7.2";
  a["1.2.840.113549.1.7.3"] = "envelopedData";
  a.envelopedData = "1.2.840.113549.1.7.3";
  a["1.2.840.113549.1.7.4"] = "signedAndEnvelopedData";
  a.signedAndEnvelopedData = "1.2.840.113549.1.7.4";
  a["1.2.840.113549.1.7.5"] = "digestedData";
  a.digestedData = "1.2.840.113549.1.7.5";
  a["1.2.840.113549.1.7.6"] = "encryptedData";
  a.encryptedData = "1.2.840.113549.1.7.6";
  a["1.2.840.113549.1.9.20"] = "friendlyName";
  a.friendlyName = "1.2.840.113549.1.9.20";
  a["1.2.840.113549.1.9.21"] = "localKeyId";
  a.localKeyId = "1.2.840.113549.1.9.21";
  a["1.2.840.113549.1.9.22.1"] = "x509Certificate";
  a.x509Certificate = "1.2.840.113549.1.9.22.1";
  a["1.2.840.113549.1.12.10.1.1"] = "keyBag";
  a.keyBag = "1.2.840.113549.1.12.10.1.1";
  a["1.2.840.113549.1.12.10.1.2"] = "pkcs8ShroudedKeyBag";
  a.pkcs8ShroudedKeyBag = "1.2.840.113549.1.12.10.1.2";
  a["1.2.840.113549.1.12.10.1.3"] = "certBag";
  a.certBag = "1.2.840.113549.1.12.10.1.3";
  a["1.2.840.113549.1.12.10.1.4"] = "crlBag";
  a.crlBag = "1.2.840.113549.1.12.10.1.4";
  a["1.2.840.113549.1.12.10.1.5"] = "secretBag";
  a.secretBag = "1.2.840.113549.1.12.10.1.5";
  a["1.2.840.113549.1.12.10.1.6"] = "safeContentsBag";
  a.safeContentsBag = "1.2.840.113549.1.12.10.1.6";
  a["1.2.840.113549.1.5.13"] = "pkcs5PBES2";
  a.pkcs5PBES2 = "1.2.840.113549.1.5.13";
  a["1.2.840.113549.1.5.12"] = "pkcs5PBKDF2";
  a.pkcs5PBKDF2 = "1.2.840.113549.1.5.12";
  a["1.2.840.113549.1.12.1.1"] = "pbeWithSHAAnd128BitRC4";
  a.pbeWithSHAAnd128BitRC4 = "1.2.840.113549.1.12.1.1";
  a["1.2.840.113549.1.12.1.2"] = "pbeWithSHAAnd40BitRC4";
  a.pbeWithSHAAnd40BitRC4 = "1.2.840.113549.1.12.1.2";
  a["1.2.840.113549.1.12.1.3"] = "pbeWithSHAAnd3-KeyTripleDES-CBC";
  a["pbeWithSHAAnd3-KeyTripleDES-CBC"] = "1.2.840.113549.1.12.1.3";
  a["1.2.840.113549.1.12.1.4"] = "pbeWithSHAAnd2-KeyTripleDES-CBC";
  a["pbeWithSHAAnd2-KeyTripleDES-CBC"] = "1.2.840.113549.1.12.1.4";
  a["1.2.840.113549.1.12.1.5"] = "pbeWithSHAAnd128BitRC2-CBC";
  a["pbeWithSHAAnd128BitRC2-CBC"] = "1.2.840.113549.1.12.1.5";
  a["1.2.840.113549.1.12.1.6"] = "pbewithSHAAnd40BitRC2-CBC";
  a["pbewithSHAAnd40BitRC2-CBC"] = "1.2.840.113549.1.12.1.6";
  a["1.2.840.113549.3.7"] = "des-EDE3-CBC";
  a["des-EDE3-CBC"] = "1.2.840.113549.3.7";
  a["2.16.840.1.101.3.4.1.2"] = "aes128-CBC";
  a["aes128-CBC"] = "2.16.840.1.101.3.4.1.2";
  a["2.16.840.1.101.3.4.1.22"] = "aes192-CBC";
  a["aes192-CBC"] = "2.16.840.1.101.3.4.1.22";
  a["2.16.840.1.101.3.4.1.42"] = "aes256-CBC";
  a["aes256-CBC"] = "2.16.840.1.101.3.4.1.42";
  a["2.5.4.3"] = "commonName";
  a.commonName = "2.5.4.3";
  a["2.5.4.5"] = "serialName";
  a.serialName = "2.5.4.5";
  a["2.5.4.6"] = "countryName";
  a.countryName = "2.5.4.6";
  a["2.5.4.7"] = "localityName";
  a.localityName = "2.5.4.7";
  a["2.5.4.8"] = "stateOrProvinceName";
  a.stateOrProvinceName = "2.5.4.8";
  a["2.5.4.10"] = "organizationName";
  a.organizationName = "2.5.4.10";
  a["2.5.4.11"] = "organizationalUnitName";
  a.organizationalUnitName = "2.5.4.11";
  a["1.2.840.113549.1.9.1"] = "emailAddress";
  a.emailAddress = "1.2.840.113549.1.9.1";
  a["2.5.29.1"] = "authorityKeyIdentifier";
  a["2.5.29.2"] = "keyAttributes";
  a["2.5.29.3"] = "certificatePolicies";
  a["2.5.29.4"] = "keyUsageRestriction";
  a["2.5.29.5"] = "policyMapping";
  a["2.5.29.6"] = "subtreesConstraint";
  a["2.5.29.7"] = "subjectAltName";
  a["2.5.29.8"] = "issuerAltName";
  a["2.5.29.9"] = "subjectDirectoryAttributes";
  a["2.5.29.10"] = "basicConstraints";
  a["2.5.29.11"] = "nameConstraints";
  a["2.5.29.12"] = "policyConstraints";
  a["2.5.29.13"] = "basicConstraints";
  a["2.5.29.14"] = "subjectKeyIdentifier";
  a.subjectKeyIdentifier = "2.5.29.14";
  a["2.5.29.15"] = "keyUsage";
  a.keyUsage = "2.5.29.15";
  a["2.5.29.16"] = "privateKeyUsagePeriod";
  a["2.5.29.17"] = "subjectAltName";
  a.subjectAltName = "2.5.29.17";
  a["2.5.29.18"] = "issuerAltName";
  a.issuerAltName = "2.5.29.18";
  a["2.5.29.19"] = "basicConstraints";
  a.basicConstraints = "2.5.29.19";
  a["2.5.29.20"] = "cRLNumber";
  a["2.5.29.21"] = "cRLReason";
  a["2.5.29.22"] = "expirationDate";
  a["2.5.29.23"] = "instructionCode";
  a["2.5.29.24"] = "invalidityDate";
  a["2.5.29.25"] = "cRLDistributionPoints";
  a["2.5.29.26"] = "issuingDistributionPoint";
  a["2.5.29.27"] = "deltaCRLIndicator";
  a["2.5.29.28"] = "issuingDistributionPoint";
  a["2.5.29.29"] = "certificateIssuer";
  a["2.5.29.30"] = "nameConstraints";
  a["2.5.29.31"] = "cRLDistributionPoints";
  a["2.5.29.32"] = "certificatePolicies";
  a["2.5.29.33"] = "policyMappings";
  a["2.5.29.34"] = "policyConstraints";
  a["2.5.29.35"] = "authorityKeyIdentifier";
  a["2.5.29.36"] = "policyConstraints";
  a["2.5.29.37"] = "extKeyUsage";
  a.extKeyUsage = "2.5.29.37";
  a["2.5.29.46"] = "freshestCRL";
  a["2.5.29.54"] = "inhibitAnyPolicy"
})();

//rsa.js (forge)

/**
 * Javascript implementation of a basic RSA algorithms.
 *
 * @author Dave Longley
 *
 * Copyright (c) 2010-2012 Digital Bazaar, Inc.
 */
(function () {
  var e = forge; /*if(typeof(window)!=="undefined"){var e=window.forge=window.forge||{}}else{if(typeof(module)!=="undefined"&&module.exports){var e={asn1:require("./asn1"),pki:{oids:require("./oids")},random:require("./random"),util:require("./util")};BigInteger=require("./jsbn");module.exports=e.pki.rsa={}}}*/;
  var d = e.asn1;
  e.pki = e.pki || {};
  e.pki.rsa = e.pki.rsa || {};
  var b = e.pki;
  var c = function (h) {
    var g;
    if (h.algorithm in e.pki.oids) {
      g = e.pki.oids[h.algorithm]
    } else {
      throw {
        message: "Unknown message digest algorithm.",
        algorithm: h.algorithm
      }
    }
    var k = d.oidToDer(g).getBytes();
    var j = d.create(d.Class.UNIVERSAL, d.Type.SEQUENCE, true, []);
    var f = d.create(d.Class.UNIVERSAL, d.Type.SEQUENCE, true, []);
    f.value.push(d.create(d.Class.UNIVERSAL, d.Type.OID, false, k));
    f.value.push(d.create(d.Class.UNIVERSAL, d.Type.NULL, false, ""));
    var i = d.create(d.Class.UNIVERSAL, d.Type.OCTETSTRING, false, h.digest().getBytes());
    j.value.push(f);
    j.value.push(i);
    return d.toDer(j).getBytes()
  };
  var a = function (f, g, j) {
    var k;
    if (j) {
      k = f.modPow(g.e, g.n)
    } else {
      if (!g.dP) {
        g.dP = g.d.mod(g.p.subtract(BigInteger.ONE))
      }
      if (!g.dQ) {
        g.dQ = g.d.mod(g.q.subtract(BigInteger.ONE))
      }
      if (!g.qInv) {
        g.qInv = g.q.modInverse(g.p)
      }
      var i = f.mod(g.p).modPow(g.dP, g.p);
      var h = f.mod(g.q).modPow(g.dQ, g.q);
      while (i.compareTo(h) < 0) {
        i = i.add(g.p)
      }
      k = i.subtract(h).multiply(g.qInv).mod(g.p).multiply(g.q).add(h)
    }
    return k
  };
  b.rsa.encrypt = function (h, u, v) {
    var n = v;
    var q = e.util.createBuffer();
    var l = Math.ceil(u.n.bitLength() / 8);
    if (v !== false && v !== true) {
      if (h.length > (l - 11)) {
        throw {
          message: "Message is too long to encrypt.",
          length: h.length,
          max: (l - 11)
        }
      }
      q.putByte(0);
      q.putByte(v);
      var j = l - 3 - h.length;
      var f;
      if (v === 0 || v === 1) {
        n = false;
        f = (v === 0) ? 0 : 255;
        for (var o = 0; o < j; ++o) {
          q.putByte(f)
        }
      } else {
        n = true;
        for (var o = 0; o < j; ++o) {
          f = Math.floor(Math.random() * 255) + 1;
          q.putByte(f)
        }
      }
      q.putByte(0)
    }
    q.putBytes(h);
    var t = new BigInteger(q.toHex(), 16);
    var s = a(t, u, n);
    var r = s.toString(16);
    var p = e.util.createBuffer();
    var g = l - Math.ceil(r.length / 2);
    while (g > 0) {
      p.putByte(0);
      --g
    }
    p.putBytes(e.util.hexToBytes(r));
    return p.getBytes()
  };
  b.rsa.decrypt = function (q, w, n, l) {
    var g = e.util.createBuffer();
    var j = Math.ceil(w.n.bitLength() / 8);
    if (q.length != j) {
      throw {
        message: "Encrypted message length is invalid.",
        length: q.length,
        expected: j
      }
    }
    var t = new BigInteger(e.util.createBuffer(q).toHex(), 16);
    var u = a(t, w, n);
    var z = u.toString(16);
    var r = e.util.createBuffer();
    var f = j - Math.ceil(z.length / 2);
    while (f > 0) {
      r.putByte(0);
      --f
    }
    r.putBytes(e.util.hexToBytes(z));
    if (l !== false) {
      var p = r.getByte();
      var v = r.getByte();
      if (p !== 0 || (n && v !== 0 && v !== 1) || (!n && v != 2) || (n && v === 0 && typeof (l) === "undefined")) {
        throw {
          message: "Encryption block is invalid."
        }
      }
      var h = 0;
      if (v === 0) {
        h = j - 3 - l;
        for (var o = 0; o < h; ++o) {
          if (r.getByte() !== 0) {
            throw {
              message: "Encryption block is invalid."
            }
          }
        }
      } else {
        if (v === 1) {
          h = 0;
          while (r.length() > 1) {
            if (r.getByte() !== 255) {
              --r.read;
              break
            } ++h
          }
        } else {
          if (v === 2) {
            h = 0;
            while (r.length() > 1) {
              if (r.getByte() === 0) {
                --r.read;
                break
              } ++h
            }
          }
        }
      }
      var s = r.getByte();
      if (s !== 0 || h !== (j - 3 - r.length())) {
        throw {
          message: "Encryption block is invalid."
        }
      }
    }
    return r.getBytes()
  };
  b.rsa.createKeyPairGenerationState = function (g, i) {
    if (typeof (g) === "string") {
      g = parseInt(g, 10)
    }
    g = g || 1024;
    var f = {
      nextBytes: function (k) {
        var n = +new Date();
        var j = e.random.getBytes(k.length);
        for (var l = 0; l < k.length; ++l) {
          k[l] = j.charCodeAt(l)
        }
        var m = +new Date()
      }
    };
    var h = {
      state: 0,
      itrs: 0,
      maxItrs: 100,
      bits: g,
      rng: f,
      e: new BigInteger((i || 65537).toString(16), 16),
      p: null,
      q: null,
      qBits: g >> 1,
      pBits: g - (g >> 1),
      pqState: 0,
      num: null,
      six: new BigInteger(null),
      addNext: 2,
      keys: null
    };
    h.six.fromInt(6);
    return h
  };
  b.rsa.stepKeyPairGenerationState = function (g, j) {
    var l = +new Date();
    var k;
    var o = 0;
    while (g.keys === null && (j <= 0 || o < j)) {
      if (g.state === 0) {
        var p = (g.p === null) ? g.pBits : g.qBits;
        var i = p - 1;
        if (g.pqState === 0) {
          g.itrs = 0;
          g.num = new BigInteger(p, g.rng);
          g.r = null;
          if (g.num.isEven()) {
            g.num.dAddOffset(1, 0)
          }
          if (!g.num.testBit(i)) {
            g.num.bitwiseTo(BigInteger.ONE.shiftLeft(i), function (n, q) {
              return n | q
            }, g.num)
          } ++g.pqState
        } else {
          if (g.pqState === 1) {
            if (g.addNext === null) {
              var f = g.num.mod(g.six).byteValue();
              if (f === 3) {
                g.num.mod.dAddOffset(2);
                f = 5
              }
              g.addNext = (f === 1) ? 2 : 4
            }
            var h = g.num.isProbablePrime(1);
            if (h) {
              ++g.pqState
            } else {
              if (g.itrs < g.maxItrs) {
                g.num.dAddOffset(g.addNext, 0);
                if (g.num.bitLength() > p) {
                  g.addNext = null;
                  g.num.subTo(BigInteger.ONE.shiftLeft(i), g.num)
                } else {
                  g.addNext = (g.addNext === 4) ? 2 : 4
                } ++g.itrs
              } else {
                g.pqState = 0
              }
            }
          } else {
            if (g.pqState === 2) {
              g.pqState = (g.num.subtract(BigInteger.ONE).gcd(g.e).compareTo(BigInteger.ONE) === 0) ? 3 : 0
            } else {
              if (g.pqState === 3) {
                g.pqState = 0;
                if (g.num.isProbablePrime(10)) {
                  if (g.p === null) {
                    g.p = g.num
                  } else {
                    g.q = g.num
                  }
                  if (g.p !== null && g.q !== null) {
                    ++g.state
                  }
                }
                g.num = null
              }
            }
          }
        }
      } else {
        if (g.state === 1) {
          if (g.p.compareTo(g.q) < 0) {
            g.num = g.p;
            g.p = g.q;
            g.q = g.num
          } ++g.state
        } else {
          if (g.state === 2) {
            g.p1 = g.p.subtract(BigInteger.ONE);
            g.q1 = g.q.subtract(BigInteger.ONE);
            g.phi = g.p1.multiply(g.q1);
            ++g.state
          } else {
            if (g.state === 3) {
              if (g.phi.gcd(g.e).compareTo(BigInteger.ONE) === 0) {
                ++g.state
              } else {
                g.p = null;
                g.q = null;
                g.state = 0
              }
            } else {
              if (g.state === 4) {
                g.n = g.p.multiply(g.q);
                if (g.n.bitLength() === g.bits) {
                  ++g.state
                } else {
                  g.q = null;
                  g.state = 0
                }
              } else {
                if (g.state === 5) {
                  var m = g.e.modInverse(g.phi);
                  g.keys = {
                    privateKey: e.pki.rsa.setPrivateKey(g.n, g.e, m, g.p, g.q, m.mod(g.p1), m.mod(g.q1), g.q.modInverse(g.p)),
                    publicKey: e.pki.rsa.setPublicKey(g.n, g.e)
                  }
                }
              }
            }
          }
        }
      }
      k = +new Date();
      o += k - l;
      l = k
    }
    return g.keys !== null
  };
  b.rsa.generateKeyPair = function (g, h) {
    var f = b.rsa.createKeyPairGenerationState(g, h);
    b.rsa.stepKeyPairGenerationState(f, 0);
    return f.keys
  };
  b.rsa.setPublicKey = function (h, g) {
    var f = {
      n: h,
      e: g
    };
    f.encrypt = function (i) {
      return b.rsa.encrypt(i, f, 2)
    };
    f.verify = function (m, i, j) {
      var n = j === undefined ? undefined : false;
      var l = b.rsa.decrypt(i, f, true, n);
      if (j === undefined) {
        var k = d.fromDer(l);
        return m === k.value[1].value
      } else {
        return j.verify(m, l, f.n.bitLength())
      }
    };
    return f
  };
  b.rsa.setPrivateKey = function (h, i, j, g, f, l, k, o) {
    var m = {
      n: h,
      e: i,
      d: j,
      p: g,
      q: f,
      dP: l,
      dQ: k,
      qInv: o
    };
    m.decrypt = function (n) {
      return b.rsa.decrypt(n, m, false)
    };
    m.sign = function (q, p) {
      var n = false;
      if (p === undefined) {
        p = {
          encode: c
        };
        n = 1
      }
      var r = p.encode(q, m.n.bitLength());
      return b.rsa.encrypt(r, m, n)
    };
    return m
  }
})();

//pki.js and pem.js (forge)

/**
 * Javascript implementation of a basic Public Key Infrastructure, including
 * support for RSA public and private keys.
 *
 * @author Dave Longley
 * @author Stefan Siegl <stesie@brokenpipe.de>
 *
 * Copyright (c) 2010-2012 Digital Bazaar, Inc.
 * Copyright (c) 2012 Stefan Siegl <stesie@brokenpipe.de>
 *
 */
(function () {
  function d(p) {
    if (typeof BigInteger === "undefined") {
      BigInteger = p.jsbn.BigInteger
    }
    var t = p.asn1;
    var j = p.pki = p.pki || {};
    var m = j.oids;
    j.pbe = {};
    var w = {};
    w.CN = m.commonName;
    w.commonName = "CN";
    w.C = m.countryName;
    w.countryName = "C";
    w.L = m.localityName;
    w.localityName = "L";
    w.ST = m.stateOrProvinceName;
    w.stateOrProvinceName = "ST";
    w.O = m.organizationName;
    w.organizationName = "O";
    w.OU = m.organizationalUnitName;
    w.organizationalUnitName = "OU";
    w.E = m.emailAddress;
    w.emailAddress = "E";
    var A = {
      name: "SubjectPublicKeyInfo",
      tagClass: t.Class.UNIVERSAL,
      type: t.Type.SEQUENCE,
      constructed: true,
      captureAsn1: "subjectPublicKeyInfo",
      value: [{
        name: "SubjectPublicKeyInfo.AlgorithmIdentifier",
        tagClass: t.Class.UNIVERSAL,
        type: t.Type.SEQUENCE,
        constructed: true,
        value: [{
          name: "AlgorithmIdentifier.algorithm",
          tagClass: t.Class.UNIVERSAL,
          type: t.Type.OID,
          constructed: false,
          capture: "publicKeyOid"
        }]
      }, {
        name: "SubjectPublicKeyInfo.subjectPublicKey",
        tagClass: t.Class.UNIVERSAL,
        type: t.Type.BITSTRING,
        constructed: false,
        value: [{
          name: "SubjectPublicKeyInfo.subjectPublicKey.RSAPublicKey",
          tagClass: t.Class.UNIVERSAL,
          type: t.Type.SEQUENCE,
          constructed: true,
          optional: true,
          captureAsn1: "rsaPublicKey"
        }]
      }]
    };
    var v = {
      name: "RSAPublicKey",
      tagClass: t.Class.UNIVERSAL,
      type: t.Type.SEQUENCE,
      constructed: true,
      value: [{
        name: "RSAPublicKey.modulus",
        tagClass: t.Class.UNIVERSAL,
        type: t.Type.INTEGER,
        constructed: false,
        capture: "publicKeyModulus"
      }, {
        name: "RSAPublicKey.exponent",
        tagClass: t.Class.UNIVERSAL,
        type: t.Type.INTEGER,
        constructed: false,
        capture: "publicKeyExponent"
      }]
    };
    var x = {
      name: "Certificate",
      tagClass: t.Class.UNIVERSAL,
      type: t.Type.SEQUENCE,
      constructed: true,
      value: [{
        name: "Certificate.TBSCertificate",
        tagClass: t.Class.UNIVERSAL,
        type: t.Type.SEQUENCE,
        constructed: true,
        captureAsn1: "tbsCertificate",
        value: [{
          name: "Certificate.TBSCertificate.version",
          tagClass: t.Class.CONTEXT_SPECIFIC,
          type: 0,
          constructed: true,
          optional: true,
          value: [{
            name: "Certificate.TBSCertificate.version.integer",
            tagClass: t.Class.UNIVERSAL,
            type: t.Type.INTEGER,
            constructed: false,
            capture: "certVersion"
          }]
        }, {
          name: "Certificate.TBSCertificate.serialNumber",
          tagClass: t.Class.UNIVERSAL,
          type: t.Type.INTEGER,
          constructed: false,
          capture: "certSerialNumber"
        }, {
          name: "Certificate.TBSCertificate.signature",
          tagClass: t.Class.UNIVERSAL,
          type: t.Type.SEQUENCE,
          constructed: true,
          value: [{
            name: "Certificate.TBSCertificate.signature.algorithm",
            tagClass: t.Class.UNIVERSAL,
            type: t.Type.OID,
            constructed: false,
            capture: "certinfoSignatureOid"
          }, {
            name: "Certificate.TBSCertificate.signature.parameters",
            tagClass: t.Class.UNIVERSAL,
            optional: true,
            captureAsn1: "certinfoSignatureParams"
          }]
        }, {
          name: "Certificate.TBSCertificate.issuer",
          tagClass: t.Class.UNIVERSAL,
          type: t.Type.SEQUENCE,
          constructed: true,
          captureAsn1: "certIssuer"
        }, {
          name: "Certificate.TBSCertificate.validity",
          tagClass: t.Class.UNIVERSAL,
          type: t.Type.SEQUENCE,
          constructed: true,
          value: [{
            name: "Certificate.TBSCertificate.validity.notBefore (utc)",
            tagClass: t.Class.UNIVERSAL,
            type: t.Type.UTCTIME,
            constructed: false,
            optional: true,
            capture: "certValidity1UTCTime"
          }, {
            name: "Certificate.TBSCertificate.validity.notBefore (generalized)",
            tagClass: t.Class.UNIVERSAL,
            type: t.Type.GENERALIZEDTIME,
            constructed: false,
            optional: true,
            capture: "certValidity2GeneralizedTime"
          }, {
            name: "Certificate.TBSCertificate.validity.notAfter (utc)",
            tagClass: t.Class.UNIVERSAL,
            type: t.Type.UTCTIME,
            constructed: false,
            optional: true,
            capture: "certValidity3UTCTime"
          }, {
            name: "Certificate.TBSCertificate.validity.notAfter (generalized)",
            tagClass: t.Class.UNIVERSAL,
            type: t.Type.GENERALIZEDTIME,
            constructed: false,
            optional: true,
            capture: "certValidity4GeneralizedTime"
          }]
        }, {
          name: "Certificate.TBSCertificate.subject",
          tagClass: t.Class.UNIVERSAL,
          type: t.Type.SEQUENCE,
          constructed: true,
          captureAsn1: "certSubject"
        }, A, {
          name: "Certificate.TBSCertificate.issuerUniqueID",
          tagClass: t.Class.CONTEXT_SPECIFIC,
          type: 1,
          constructed: true,
          optional: true,
          value: [{
            name: "Certificate.TBSCertificate.issuerUniqueID.id",
            tagClass: t.Class.UNIVERSAL,
            type: t.Type.BITSTRING,
            constructed: false,
            capture: "certIssuerUniqueId"
          }]
        }, {
          name: "Certificate.TBSCertificate.subjectUniqueID",
          tagClass: t.Class.CONTEXT_SPECIFIC,
          type: 2,
          constructed: true,
          optional: true,
          value: [{
            name: "Certificate.TBSCertificate.subjectUniqueID.id",
            tagClass: t.Class.UNIVERSAL,
            type: t.Type.BITSTRING,
            constructed: false,
            capture: "certSubjectUniqueId"
          }]
        }, {
          name: "Certificate.TBSCertificate.extensions",
          tagClass: t.Class.CONTEXT_SPECIFIC,
          type: 3,
          constructed: true,
          captureAsn1: "certExtensions",
          optional: true
        }]
      }, {
        name: "Certificate.signatureAlgorithm",
        tagClass: t.Class.UNIVERSAL,
        type: t.Type.SEQUENCE,
        constructed: true,
        value: [{
          name: "Certificate.signatureAlgorithm.algorithm",
          tagClass: t.Class.UNIVERSAL,
          type: t.Type.OID,
          constructed: false,
          capture: "certSignatureOid"
        }, {
          name: "Certificate.TBSCertificate.signature.parameters",
          tagClass: t.Class.UNIVERSAL,
          optional: true,
          captureAsn1: "certSignatureParams"
        }]
      }, {
        name: "Certificate.signatureValue",
        tagClass: t.Class.UNIVERSAL,
        type: t.Type.BITSTRING,
        constructed: false,
        capture: "certSignature"
      }]
    };
    var s = {
      name: "PrivateKeyInfo",
      tagClass: t.Class.UNIVERSAL,
      type: t.Type.SEQUENCE,
      constructed: true,
      value: [{
        name: "PrivateKeyInfo.version",
        tagClass: t.Class.UNIVERSAL,
        type: t.Type.INTEGER,
        constructed: false,
        capture: "privateKeyVersion"
      }, {
        name: "PrivateKeyInfo.privateKeyAlgorithm",
        tagClass: t.Class.UNIVERSAL,
        type: t.Type.SEQUENCE,
        constructed: true,
        value: [{
          name: "AlgorithmIdentifier.algorithm",
          tagClass: t.Class.UNIVERSAL,
          type: t.Type.OID,
          constructed: false,
          capture: "privateKeyOid"
        }]
      }, {
        name: "PrivateKeyInfo",
        tagClass: t.Class.UNIVERSAL,
        type: t.Type.OCTETSTRING,
        constructed: false,
        capture: "privateKey"
      }]
    };
    var z = {
      name: "RSAPrivateKey",
      tagClass: t.Class.UNIVERSAL,
      type: t.Type.SEQUENCE,
      constructed: true,
      value: [{
        name: "RSAPrivateKey.version",
        tagClass: t.Class.UNIVERSAL,
        type: t.Type.INTEGER,
        constructed: false,
        capture: "privateKeyVersion"
      }, {
        name: "RSAPrivateKey.modulus",
        tagClass: t.Class.UNIVERSAL,
        type: t.Type.INTEGER,
        constructed: false,
        capture: "privateKeyModulus"
      }, {
        name: "RSAPrivateKey.publicExponent",
        tagClass: t.Class.UNIVERSAL,
        type: t.Type.INTEGER,
        constructed: false,
        capture: "privateKeyPublicExponent"
      }, {
        name: "RSAPrivateKey.privateExponent",
        tagClass: t.Class.UNIVERSAL,
        type: t.Type.INTEGER,
        constructed: false,
        capture: "privateKeyPrivateExponent"
      }, {
        name: "RSAPrivateKey.prime1",
        tagClass: t.Class.UNIVERSAL,
        type: t.Type.INTEGER,
        constructed: false,
        capture: "privateKeyPrime1"
      }, {
        name: "RSAPrivateKey.prime2",
        tagClass: t.Class.UNIVERSAL,
        type: t.Type.INTEGER,
        constructed: false,
        capture: "privateKeyPrime2"
      }, {
        name: "RSAPrivateKey.exponent1",
        tagClass: t.Class.UNIVERSAL,
        type: t.Type.INTEGER,
        constructed: false,
        capture: "privateKeyExponent1"
      }, {
        name: "RSAPrivateKey.exponent2",
        tagClass: t.Class.UNIVERSAL,
        type: t.Type.INTEGER,
        constructed: false,
        capture: "privateKeyExponent2"
      }, {
        name: "RSAPrivateKey.coefficient",
        tagClass: t.Class.UNIVERSAL,
        type: t.Type.INTEGER,
        constructed: false,
        capture: "privateKeyCoefficient"
      }]
    };
    var y = {
      name: "EncryptedPrivateKeyInfo",
      tagClass: t.Class.UNIVERSAL,
      type: t.Type.SEQUENCE,
      constructed: true,
      value: [{
        name: "EncryptedPrivateKeyInfo.encryptionAlgorithm",
        tagClass: t.Class.UNIVERSAL,
        type: t.Type.SEQUENCE,
        constructed: true,
        value: [{
          name: "AlgorithmIdentifier.algorithm",
          tagClass: t.Class.UNIVERSAL,
          type: t.Type.OID,
          constructed: false,
          capture: "encryptionOid"
        }, {
          name: "AlgorithmIdentifier.parameters",
          tagClass: t.Class.UNIVERSAL,
          type: t.Type.SEQUENCE,
          constructed: true,
          captureAsn1: "encryptionParams"
        }]
      }, {
        name: "EncryptedPrivateKeyInfo.encryptedData",
        tagClass: t.Class.UNIVERSAL,
        type: t.Type.OCTETSTRING,
        constructed: false,
        capture: "encryptedData"
      }]
    };
    var C = {
      name: "PBES2Algorithms",
      tagClass: t.Class.UNIVERSAL,
      type: t.Type.SEQUENCE,
      constructed: true,
      value: [{
        name: "PBES2Algorithms.keyDerivationFunc",
        tagClass: t.Class.UNIVERSAL,
        type: t.Type.SEQUENCE,
        constructed: true,
        value: [{
          name: "PBES2Algorithms.keyDerivationFunc.oid",
          tagClass: t.Class.UNIVERSAL,
          type: t.Type.OID,
          constructed: false,
          capture: "kdfOid"
        }, {
          name: "PBES2Algorithms.params",
          tagClass: t.Class.UNIVERSAL,
          type: t.Type.SEQUENCE,
          constructed: true,
          value: [{
            name: "PBES2Algorithms.params.salt",
            tagClass: t.Class.UNIVERSAL,
            type: t.Type.OCTETSTRING,
            constructed: false,
            capture: "kdfSalt"
          }, {
            name: "PBES2Algorithms.params.iterationCount",
            tagClass: t.Class.UNIVERSAL,
            type: t.Type.INTEGER,
            onstructed: true,
            capture: "kdfIterationCount"
          }]
        }]
      }, {
        name: "PBES2Algorithms.encryptionScheme",
        tagClass: t.Class.UNIVERSAL,
        type: t.Type.SEQUENCE,
        constructed: true,
        value: [{
          name: "PBES2Algorithms.encryptionScheme.oid",
          tagClass: t.Class.UNIVERSAL,
          type: t.Type.OID,
          constructed: false,
          capture: "encOid"
        }, {
          name: "PBES2Algorithms.encryptionScheme.iv",
          tagClass: t.Class.UNIVERSAL,
          type: t.Type.OCTETSTRING,
          constructed: false,
          capture: "encIv"
        }]
      }]
    };
    var F = {
      name: "pkcs-12PbeParams",
      tagClass: t.Class.UNIVERSAL,
      type: t.Type.SEQUENCE,
      constructed: true,
      value: [{
        name: "pkcs-12PbeParams.salt",
        tagClass: t.Class.UNIVERSAL,
        type: t.Type.OCTETSTRING,
        constructed: false,
        capture: "salt"
      }, {
        name: "pkcs-12PbeParams.iterations",
        tagClass: t.Class.UNIVERSAL,
        type: t.Type.INTEGER,
        constructed: false,
        capture: "iterations"
      }]
    };
    var u = {
      name: "rsapss",
      tagClass: t.Class.UNIVERSAL,
      type: t.Type.SEQUENCE,
      constructed: true,
      value: [{
        name: "rsapss.hashAlgorithm",
        tagClass: t.Class.CONTEXT_SPECIFIC,
        type: 0,
        constructed: true,
        value: [{
          name: "rsapss.hashAlgorithm.AlgorithmIdentifier",
          tagClass: t.Class.UNIVERSAL,
          type: t.Class.SEQUENCE,
          constructed: true,
          optional: true,
          value: [{
            name: "rsapss.hashAlgorithm.AlgorithmIdentifier.algorithm",
            tagClass: t.Class.UNIVERSAL,
            type: t.Type.OID,
            constructed: false,
            capture: "hashOid"
          }]
        }]
      }, {
        name: "rsapss.maskGenAlgorithm",
        tagClass: t.Class.CONTEXT_SPECIFIC,
        type: 1,
        constructed: true,
        value: [{
          name: "rsapss.maskGenAlgorithm.AlgorithmIdentifier",
          tagClass: t.Class.UNIVERSAL,
          type: t.Class.SEQUENCE,
          constructed: true,
          optional: true,
          value: [{
            name: "rsapss.maskGenAlgorithm.AlgorithmIdentifier.algorithm",
            tagClass: t.Class.UNIVERSAL,
            type: t.Type.OID,
            constructed: false,
            capture: "maskGenOid"
          }, {
            name: "rsapss.maskGenAlgorithm.AlgorithmIdentifier.params",
            tagClass: t.Class.UNIVERSAL,
            type: t.Type.SEQUENCE,
            constructed: true,
            value: [{
              name: "rsapss.maskGenAlgorithm.AlgorithmIdentifier.params.algorithm",
              tagClass: t.Class.UNIVERSAL,
              type: t.Type.OID,
              constructed: false,
              capture: "maskGenHashOid"
            }]
          }]
        }]
      }, {
        name: "rsapss.saltLength",
        tagClass: t.Class.CONTEXT_SPECIFIC,
        type: 2,
        optional: true,
        value: [{
          name: "rsapss.saltLength.saltLength",
          tagClass: t.Class.UNIVERSAL,
          type: t.Class.INTEGER,
          constructed: false,
          capture: "saltLength"
        }]
      }, {
        name: "rsapss.trailerField",
        tagClass: t.Class.CONTEXT_SPECIFIC,
        type: 3,
        optional: true,
        value: [{
          name: "rsapss.trailer.trailer",
          tagClass: t.Class.UNIVERSAL,
          type: t.Class.INTEGER,
          constructed: false,
          capture: "trailer"
        }]
      }]
    };
    var k = {
      name: "CertificationRequestInfo",
      tagClass: t.Class.UNIVERSAL,
      type: t.Type.SEQUENCE,
      constructed: true,
      captureAsn1: "certificationRequestInfo",
      value: [{
        name: "CertificationRequestInfo.integer",
        tagClass: t.Class.UNIVERSAL,
        type: t.Type.INTEGER,
        constructed: false,
        capture: "certificationRequestInfoVersion"
      }, {
        name: "CertificationRequestInfo.subject",
        tagClass: t.Class.UNIVERSAL,
        type: t.Type.SEQUENCE,
        constructed: true,
        captureAsn1: "certificationRequestInfoSubject"
      }, A, {
        name: "CertificationRequestInfo.attributes",
        tagClass: t.Class.CONTEXT_SPECIFIC,
        type: 0,
        constructed: true,
        optional: true,
        capture: "certificationRequestInfoAttributes",
        value: [{
          name: "CertificationRequestInfo.attributes",
          tagClass: t.Class.UNIVERSAL,
          type: t.Type.SEQUENCE,
          constructed: true,
          value: [{
            name: "CertificationRequestInfo.attributes.type",
            tagClass: t.Class.UNIVERSAL,
            type: t.Type.OID,
            constructed: false
          }, {
            name: "CertificationRequestInfo.attributes.value",
            tagClass: t.Class.UNIVERSAL,
            type: t.Type.SET,
            constructed: true
          }]
        }]
      }]
    };
    var q = {
      name: "CertificationRequest",
      tagClass: t.Class.UNIVERSAL,
      type: t.Type.SEQUENCE,
      constructed: true,
      captureAsn1: "csr",
      value: [k, {
        name: "CertificationRequest.signatureAlgorithm",
        tagClass: t.Class.UNIVERSAL,
        type: t.Type.SEQUENCE,
        constructed: true,
        value: [{
          name: "CertificationRequest.signatureAlgorithm.algorithm",
          tagClass: t.Class.UNIVERSAL,
          type: t.Type.OID,
          constructed: false,
          capture: "csrSignatureOid"
        }, {
          name: "CertificationRequest.signatureAlgorithm.parameters",
          tagClass: t.Class.UNIVERSAL,
          optional: true,
          captureAsn1: "csrSignatureParams"
        }]
      }, {
          name: "CertificationRequest.signature",
          tagClass: t.Class.UNIVERSAL,
          type: t.Type.BITSTRING,
          constructed: false,
          capture: "csrSignature"
        }]
    };
    j.RDNAttributesAsArray = function (K, J) {
      var M = [];
      var N, G, L;
      for (var H = 0; H < K.value.length; ++H) {
        N = K.value[H];
        for (var I = 0; I < N.value.length; ++I) {
          L = {};
          G = N.value[I];
          L.type = t.derToOid(G.value[0].value);
          L.value = G.value[1].value;
          L.valueTagClass = G.value[1].type;
          if (L.type in m) {
            L.name = m[L.type];
            if (L.name in w) {
              L.shortName = w[L.name]
            }
          }
          if (J) {
            J.update(L.type);
            J.update(L.value)
          }
          M.push(L)
        }
      }
      return M
    };
    j.CRIAttributesAsArray = function (I) {
      var M = [];
      for (var J = 0; J < I.length; ++J) {
        var H = I[J];
        var K = t.derToOid(H.value[0].value);
        var G = H.value[1].value;
        for (var N = 0; N < G.length; ++N) {
          var L = {};
          L.type = K;
          L.value = G[N].value;
          L.valueTagClass = G[N].type;
          if (L.type in m) {
            L.name = m[L.type];
            if (L.name in w) {
              L.shortName = w[L.name]
            }
          }
          M.push(L)
        }
      }
      return M
    };
    var i = function (K, H) {
      if (typeof H === "string") {
        H = {
          shortName: H
        }
      }
      var J = null;
      var G;
      for (var I = 0; J === null && I < K.attributes.length; ++I) {
        G = K.attributes[I];
        if (H.type && H.type === G.type) {
          J = G
        } else {
          if (H.name && H.name === G.name) {
            J = G
          } else {
            if (H.shortName && H.shortName === G.shortName) {
              J = G
            }
          }
        }
      }
      return J
    };
    var o = function (O) {
      var R = [];
      var S, H, K;
      for (var Q = 0; Q < O.value.length; ++Q) {
        K = O.value[Q];
        for (var L = 0; L < K.value.length; ++L) {
          H = K.value[L];
          S = {};
          S.id = t.derToOid(H.value[0].value);
          S.critical = false;
          if (H.value[1].type === t.Type.BOOLEAN) {
            S.critical = (H.value[1].value.charCodeAt(0) !== 0);
            S.value = H.value[2].value
          } else {
            S.value = H.value[1].value
          }
          if (S.id in m) {
            S.name = m[S.id];
            if (S.name === "keyUsage") {
              var V = t.fromDer(S.value);
              var U = 0;
              var T = 0;
              if (V.value.length > 1) {
                U = V.value.charCodeAt(1);
                T = V.value.length > 2 ? V.value.charCodeAt(2) : 0
              }
              S.digitalSignature = (U & 128) === 128;
              S.nonRepudiation = (U & 64) === 64;
              S.keyEncipherment = (U & 32) === 32;
              S.dataEncipherment = (U & 16) === 16;
              S.keyAgreement = (U & 8) === 8;
              S.keyCertSign = (U & 4) === 4;
              S.cRLSign = (U & 2) === 2;
              S.encipherOnly = (U & 1) === 1;
              S.decipherOnly = (T & 128) === 128
            } else {
              if (S.name === "basicConstraints") {
                var V = t.fromDer(S.value);
                if (V.value.length > 0) {
                  S.cA = (V.value[0].value.charCodeAt(0) !== 0)
                } else {
                  S.cA = false
                }
                if (V.value.length > 1) {
                  var P = p.util.createBuffer(V.value[1].value);
                  S.pathLenConstraint = P.getInt(P.length() << 3)
                }
              } else {
                if (S.name === "extKeyUsage") {
                  var V = t.fromDer(S.value);
                  for (var N = 0; N < V.value.length; ++N) {
                    var J = t.derToOid(V.value[N].value);
                    if (J in m) {
                      S[m[J]] = true
                    } else {
                      S[J] = true
                    }
                  }
                } else {
                  if (S.name === "subjectAltName" || S.name === "issuerAltName") {
                    S.altNames = [];
                    var M;
                    var V = t.fromDer(S.value);
                    for (var I = 0; I < V.value.length; ++I) {
                      M = V.value[I];
                      var G = {
                        type: M.type,
                        value: M.value
                      };
                      S.altNames.push(G);
                      switch (M.type) {
                        case 1:
                        case 2:
                        case 6:
                          break;
                        case 7:
                          break;
                        case 8:
                          G.oid = t.derToOid(M.value);
                          break;
                        default:
                      }
                    }
                  }
                }
              }
            }
          }
          R.push(S)
        }
      }
      return R
    };
    j.pemToDer = function (G) {
      var H = p.pem.decode(G)[0];
      if (H.procType && H.procType.type === "ENCRYPTED") {
        throw {
          message: "Could not convert PEM to DER; PEM is encrypted."
        }
      }
      return p.util.createBuffer(H.body)
    };
    var r = function (G) {
      var H = G.toString(16);
      if (H[0] >= "8") {
        H = "00" + H
      }
      return p.util.hexToBytes(H)
    };
    var g = function (I, J, G) {
      var K = {};
      if (I !== m["RSASSA-PSS"]) {
        return K
      }
      if (G) {
        K = {
          hash: {
            algorithmOid: m.sha1
          },
          mgf: {
            algorithmOid: m.mgf1,
            hash: {
              algorithmOid: m.sha1
            }
          },
          saltLength: 20
        }
      }
      var H = {};
      var L = [];
      if (!t.validate(J, u, H, L)) {
        throw {
          message: "Cannot read RSASSA-PSS parameter block.",
          errors: L
        }
      }
      if (H.hashOid !== undefined) {
        K.hash = K.hash || {};
        K.hash.algorithmOid = t.derToOid(H.hashOid)
      }
      if (H.maskGenOid !== undefined) {
        K.mgf = K.mgf || {};
        K.mgf.algorithmOid = t.derToOid(H.maskGenOid);
        K.mgf.hash = K.mgf.hash || {};
        K.mgf.hash.algorithmOid = t.derToOid(H.maskGenHashOid)
      }
      if (H.saltLength !== undefined) {
        K.saltLength = H.saltLength.charCodeAt(0)
      }
      return K
    };
    j.certificateFromPem = function (H, K, G) {
      var J = p.pem.decode(H)[0];
      if (J.type !== "CERTIFICATE" && J.type !== "X509 CERTIFICATE" && J.type !== "TRUSTED CERTIFICATE") {
        throw {
          message: 'Could not convert certificate from PEM; PEM header type is not "CERTIFICATE", "X509 CERTIFICATE", or "TRUSTED CERTIFICATE".',
          headerType: J.type
        }
      }
      if (J.procType && J.procType.type === "ENCRYPTED") {
        throw {
          message: "Could not convert certificate from PEM; PEM is encrypted."
        }
      }
      var I = t.fromDer(J.body, G);
      return j.certificateFromAsn1(I, K)
    };
    j.certificateToPem = function (G, I) {
      var H = {
        type: "CERTIFICATE",
        body: t.toDer(j.certificateToAsn1(G)).getBytes()
      };
      return p.pem.encode(H, {
        maxline: I
      })
    };
    j.publicKeyFromPem = function (G) {
      var I = p.pem.decode(G)[0];
      if (I.type !== "PUBLIC KEY" && I.type !== "RSA PUBLIC KEY") {
        throw {
          message: 'Could not convert public key from PEM; PEM header type is not "PUBLIC KEY" or "RSA PUBLIC KEY".',
          headerType: I.type
        }
      }
      if (I.procType && I.procType.type === "ENCRYPTED") {
        throw {
          message: "Could not convert public key from PEM; PEM is encrypted."
        }
      };
      var H = t.fromDer(I.body);
      return j.publicKeyFromAsn1(H)
    };
    j.publicKeyToPem = function (G, I) {
      var H = {
        type: "PUBLIC KEY",
        body: t.toDer(j.publicKeyToAsn1(G)).getBytes()
      };
      return p.pem.encode(H, {
        maxline: I
      })
    };
    j.publicKeyToRSAPublicKeyPem = function (G, I) {
      var H = {
        type: "RSA PUBLIC KEY",
        body: t.toDer(j.publicKeyToRSAPublicKey(G)).getBytes()
      };
      return p.pem.encode(H, {
        maxline: I
      })
    };
    j.privateKeyFromPem = function (G) {
      var I = p.pem.decode(G)[0];
      if (I.type !== "PRIVATE KEY" && I.type !== "RSA PRIVATE KEY") {
        throw {
          message: 'Could not convert private key from PEM; PEM header type is not "PRIVATE KEY" or "RSA PRIVATE KEY".',
          headerType: I.type
        }
      }
      if (I.procType && I.procType.type === "ENCRYPTED") {
        throw {
          message: "Could not convert private key from PEM; PEM is encrypted."
        }
      }
      var H = t.fromDer(I.body);
      return j.privateKeyFromAsn1(H)
    };
    j.privateKeyToPem = function (G, I) {
      var H = {
        type: "RSA PRIVATE KEY",
        body: t.toDer(j.privateKeyToAsn1(G)).getBytes()
      };
      return p.pem.encode(H, {
        maxline: I
      })
    };
    j.certificationRequestFromPem = function (H, K, G) {
      var J = p.pem.decode(H)[0];
      if (J.type !== "CERTIFICATE REQUEST") {
        throw {
          message: 'Could not convert certification request from PEM; PEM header type is not "CERTIFICATE REQUEST".',
          headerType: J.type
        }
      }
      if (J.procType && J.procType.type === "ENCRYPTED") {
        throw {
          message: "Could not convert certification request from PEM; PEM is encrypted."
        }
      }
      var I = t.fromDer(J.body, G);
      return j.certificationRequestFromAsn1(I, K)
    };
    j.certificationRequestToPem = function (G, I) {
      var H = {
        type: "CERTIFICATE REQUEST",
        body: t.toDer(j.certificationRequestToAsn1(G)).getBytes()
      };
      return p.pem.encode(H, {
        maxline: I
      })
    };
    j.createCertificate = function () {
      var G = {};
      G.version = 2;
      G.serialNumber = "00";
      G.signatureOid = null;
      G.signature = null;
      G.siginfo = {};
      G.siginfo.algorithmOid = null;
      G.validity = {};
      G.validity.notBefore = new Date();
      G.validity.notAfter = new Date();
      G.issuer = {};
      G.issuer.getField = function (I) {
        return i(G.issuer, I)
      };
      G.issuer.addField = function (I) {
        H([I]);
        G.issuer.attributes.push(I)
      };
      G.issuer.attributes = [];
      G.issuer.hash = null;
      G.subject = {};
      G.subject.getField = function (I) {
        return i(G.subject, I)
      };
      G.subject.addField = function (I) {
        H([I]);
        G.subject.attributes.push(I)
      };
      G.subject.attributes = [];
      G.subject.hash = null;
      G.extensions = [];
      G.publicKey = null;
      G.md = null;
      var H = function (J) {
        var I;
        for (var K = 0; K < J.length; ++K) {
          I = J[K];
          if (typeof (I.name) === "undefined") {
            if (I.type && I.type in j.oids) {
              I.name = j.oids[I.type]
            } else {
              if (I.shortName && I.shortName in w) {
                I.name = j.oids[w[I.shortName]]
              }
            }
          }
          if (typeof (I.type) === "undefined") {
            if (I.name && I.name in j.oids) {
              I.type = j.oids[I.name]
            } else {
              throw {
                message: "Attribute type not specified.",
                attribute: I
              }
            }
          }
          if (typeof (I.shortName) === "undefined") {
            if (I.name && I.name in w) {
              I.shortName = w[I.name]
            }
          }
          if (typeof (I.value) === "undefined") {
            throw {
              message: "Attribute value not specified.",
              attribute: I
            }
          }
        }
      };
      G.setSubject = function (I, J) {
        H(I);
        G.subject.attributes = I;
        delete G.subject.uniqueId;
        if (J) {
          G.subject.uniqueId = J
        }
        G.subject.hash = null
      };
      G.setIssuer = function (I, J) {
        H(I);
        G.issuer.attributes = I;
        delete G.issuer.uniqueId;
        if (J) {
          G.issuer.uniqueId = J
        }
        G.issuer.hash = null
      };
      G.setExtensions = function (L) {
        var P;
        for (var N = 0; N < L.length; ++N) {
          P = L[N];
          if (typeof (P.name) === "undefined") {
            if (P.id && P.id in j.oids) {
              P.name = j.oids[P.id]
            }
          }
          if (typeof (P.id) === "undefined") {
            if (P.name && P.name in j.oids) {
              P.id = j.oids[P.name]
            } else {
              throw {
                message: "Extension ID not specified.",
                extension: P
              }
            }
          }
          if (typeof (P.value) === "undefined") {
            if (P.name === "keyUsage") {
              var K = 0;
              var R = 0;
              var Q = 0;
              if (P.digitalSignature) {
                R |= 128;
                K = 7
              }
              if (P.nonRepudiation) {
                R |= 64;
                K = 6
              }
              if (P.keyEncipherment) {
                R |= 32;
                K = 5
              }
              if (P.dataEncipherment) {
                R |= 16;
                K = 4
              }
              if (P.keyAgreement) {
                R |= 8;
                K = 3
              }
              if (P.keyCertSign) {
                R |= 4;
                K = 2
              }
              if (P.cRLSign) {
                R |= 2;
                K = 1
              }
              if (P.encipherOnly) {
                R |= 1;
                K = 0
              }
              if (P.decipherOnly) {
                Q |= 128;
                K = 7
              }
              var S = String.fromCharCode(K);
              if (Q !== 0) {
                S += String.fromCharCode(R) + String.fromCharCode(Q)
              } else {
                if (R !== 0) {
                  S += String.fromCharCode(R)
                }
              }
              P.value = t.create(t.Class.UNIVERSAL, t.Type.BITSTRING, false, S)
            } else {
              if (P.name === "basicConstraints") {
                P.value = t.create(t.Class.UNIVERSAL, t.Type.SEQUENCE, true, []);
                if (P.cA) {
                  P.value.value.push(t.create(t.Class.UNIVERSAL, t.Type.BOOLEAN, false, String.fromCharCode(255)))
                }
                if (P.pathLenConstraint) {
                  var O = P.pathLenConstraint;
                  var M = p.util.createBuffer();
                  M.putInt(O, O.toString(2).length);
                  P.value.value.push(t.create(t.Class.UNIVERSAL, t.Type.INTEGER, false, M.getBytes()))
                }
              } else {
                if (P.name === "extKeyUsage") {
                  P.value = t.create(t.Class.UNIVERSAL, t.Type.SEQUENCE, true, []);
                  var U = P.value.value;
                  for (var T in P) {
                    if (P[T] !== true) {
                      continue
                    }
                    if (T in m) {
                      U.push(t.create(t.Class.UNIVERSAL, t.Type.OID, false, t.oidToDer(m[T]).getBytes()))
                    } else {
                      if (T.indexOf(".") !== -1) {
                        U.push(t.create(t.Class.UNIVERSAL, t.Type.OID, false, t.oidToDer(T).getBytes()))
                      }
                    }
                  }
                } else {
                  if (P.name === "subjectAltName" || P.name === "issuerAltName") {
                    P.value = t.create(t.Class.UNIVERSAL, t.Type.SEQUENCE, true, []);
                    var I;
                    for (var J = 0; J < P.altNames.length; ++J) {
                      I = P.altNames[J];
                      var S = I.value;
                      if (I.type === 8) {
                        S = t.oidToDer(S)
                      }
                      P.value.value.push(t.create(t.Class.CONTEXT_SPECIFIC, I.type, false, S))
                    }
                  }
                }
              }
            }
            if (typeof (P.value) === "undefined") {
              throw {
                message: "Extension value not specified.",
                extension: P
              }
            }
          }
        }
        G.extensions = L
      };
      G.getExtension = function (I) {
        if (typeof I === "string") {
          I = {
            name: I
          }
        }
        var L = null;
        var K;
        for (var J = 0; L === null && J < G.extensions.length; ++J) {
          K = G.extensions[J];
          if (I.id && K.id === I.id) {
            L = K
          } else {
            if (I.name && K.name === I.name) {
              L = K
            }
          }
        }
        return L
      };
      G.sign = function (J) {
        G.signatureOid = m.sha1withRSAEncryption;
        G.siginfo.algorithmOid = m.sha1withRSAEncryption;
        G.md = p.md.sha1.create();
        G.tbsCertificate = j.getTBSCertificate(G);
        var I = t.toDer(G.tbsCertificate);
        G.md.update(I.getBytes());
        G.signature = J.sign(G.md)
      };
      G.verify = function (I) {
        var N = false;
        var O = I.md;
        if (O === null) {
          if (I.signatureOid in m) {
            var K = m[I.signatureOid];
            switch (K) {
              case "sha1withRSAEncryption":
                O = p.md.sha1.create();
                break;
              case "md5withRSAEncryption":
                O = p.md.md5.create();
                break;
              case "sha256WithRSAEncryption":
                O = p.md.sha256.create();
                break;
              case "RSASSA-PSS":
                O = p.md.sha256.create();
                break
            }
          }
          if (O === null) {
            throw {
              message: "Could not compute certificate digest. Unknown signature OID.",
              signatureOid: I.signatureOid
            }
          }
          var P = I.tbsCertificate || j.getTBSCertificate(I);
          var Q = t.toDer(P);
          O.update(Q.getBytes())
        }
        if (O !== null) {
          var J = undefined;
          switch (I.signatureOid) {
            case m.sha1withRSAEncryption:
              J = undefined;
              break;
            case m["RSASSA-PSS"]:
              var M, L;
              M = m[I.signatureParameters.mgf.hash.algorithmOid];
              if (M === undefined || p.md[M] === undefined) {
                throw {
                  message: "Unsupported MGF hash function.",
                  oid: I.signatureParameters.mgf.hash.algorithmOid,
                  name: M
                }
              }
              L = m[I.signatureParameters.mgf.algorithmOid];
              if (L === undefined || p.mgf[L] === undefined) {
                throw {
                  message: "Unsupported MGF function.",
                  oid: I.signatureParameters.mgf.algorithmOid,
                  name: L
                }
              }
              L = p.mgf[L].create(p.md[M].create());
              M = m[I.signatureParameters.hash.algorithmOid];
              if (M === undefined || p.md[M] === undefined) {
                throw {
                  message: "Unsupported RSASSA-PSS hash function.",
                  oid: I.signatureParameters.hash.algorithmOid,
                  name: M
                }
              }
              J = p.pss.create(p.md[M].create(), L, I.signatureParameters.saltLength);
              break
          }
          N = G.publicKey.verify(O.digest().getBytes(), I.signature, J)
        }
        return N
      };
      G.isIssuer = function (L) {
        var N = false;
        var J = G.issuer;
        var K = L.subject;
        if (J.hash && K.hash) {
          N = (J.hash === K.hash)
        } else {
          if (J.attributes.length === K.attributes.length) {
            N = true;
            var I, M;
            for (var O = 0; N && O < J.attributes.length; ++O) {
              I = J.attributes[O];
              M = K.attributes[O];
              if (I.type !== M.type || I.value !== M.value) {
                N = false
              }
            }
          }
        }
        return N
      };
      return G
    };
    j.certificateFromAsn1 = function (K, R) {
      var S = {};
      var Q = [];
      if (!t.validate(K, x, S, Q)) {
        throw {
          message: "Cannot read X.509 certificate. ASN.1 object is not an X509v3 Certificate.",
          errors: Q
        }
      }
      if (typeof S.certSignature !== "string") {
        var J = "\x00";
        for (var L = 0; L < S.certSignature.length; ++L) {
          J += t.toDer(S.certSignature[L]).getBytes()
        }
        S.certSignature = J
      }
      var I = t.derToOid(S.publicKeyOid);
      if (I !== j.oids.rsaEncryption) {
        throw {
          message: "Cannot read public key. OID is not RSA."
        }
      }
      var M = j.createCertificate();
      M.version = S.certVersion ? S.certVersion.charCodeAt(0) : 0;
      var G = p.util.createBuffer(S.certSerialNumber);
      M.serialNumber = G.toHex();
      M.signatureOid = p.asn1.derToOid(S.certSignatureOid);
      M.signatureParameters = g(M.signatureOid, S.certSignatureParams, true);
      M.siginfo.algorithmOid = p.asn1.derToOid(S.certinfoSignatureOid);
      M.siginfo.parameters = g(M.siginfo.algorithmOid, S.certinfoSignatureParams, false);
      var H = p.util.createBuffer(S.certSignature);
      ++H.read;
      M.signature = H.getBytes();
      var O = [];
      if (S.certValidity1UTCTime !== undefined) {
        O.push(t.utcTimeToDate(S.certValidity1UTCTime))
      }
      if (S.certValidity2GeneralizedTime !== undefined) {
        O.push(t.generalizedTimeToDate(S.certValidity2GeneralizedTime))
      }
      if (S.certValidity3UTCTime !== undefined) {
        O.push(t.utcTimeToDate(S.certValidity3UTCTime))
      }
      if (S.certValidity4GeneralizedTime !== undefined) {
        O.push(t.generalizedTimeToDate(S.certValidity4GeneralizedTime))
      }
      if (O.length > 2) {
        throw {
          message: "Cannot read notBefore/notAfter validity times; more than two times were provided in the certificate."
        }
      }
      if (O.length < 2) {
        throw {
          message: "Cannot read notBefore/notAfter validity times; they were not provided as either UTCTime or GeneralizedTime."
        }
      }
      M.validity.notBefore = O[0];
      M.validity.notAfter = O[1];
      M.tbsCertificate = S.tbsCertificate;
      if (R) {
        M.md = null;
        if (M.signatureOid in m) {
          var I = m[M.signatureOid];
          switch (I) {
            case "sha1withRSAEncryption":
              M.md = p.md.sha1.create();
              break;
            case "md5withRSAEncryption":
              M.md = p.md.md5.create();
              break;
            case "sha256WithRSAEncryption":
              M.md = p.md.sha256.create();
              break;
            case "RSASSA-PSS":
              M.md = p.md.sha256.create();
              break
          }
        }
        if (M.md === null) {
          throw {
            message: "Could not compute certificate digest. Unknown signature OID.",
            signatureOid: M.signatureOid
          }
        }
        var T = t.toDer(M.tbsCertificate);
        M.md.update(T.getBytes())
      }
      var N = p.md.sha1.create();
      M.issuer.getField = function (U) {
        return i(M.issuer, U)
      };
      M.issuer.addField = function (U) {
        _fillMissingFields([U]);
        M.issuer.attributes.push(U)
      };
      M.issuer.attributes = j.RDNAttributesAsArray(S.certIssuer, N);
      if (S.certIssuerUniqueId) {
        M.issuer.uniqueId = S.certIssuerUniqueId
      }
      M.issuer.hash = N.digest().toHex();
      var P = p.md.sha1.create();
      M.subject.getField = function (U) {
        return i(M.subject, U)
      };
      M.subject.addField = function (U) {
        _fillMissingFields([U]);
        M.subject.attributes.push(U)
      };
      M.subject.attributes = j.RDNAttributesAsArray(S.certSubject, P);
      if (S.certSubjectUniqueId) {
        M.subject.uniqueId = S.certSubjectUniqueId
      }
      M.subject.hash = P.digest().toHex();
      if (S.certExtensions) {
        M.extensions = o(S.certExtensions)
      } else {
        M.extensions = []
      }
      M.publicKey = j.publicKeyFromAsn1(S.subjectPublicKeyInfo);
      return M
    };
    j.certificationRequestFromAsn1 = function (I, O) {
      var P = {};
      var N = [];
      if (!t.validate(I, q, P, N)) {
        throw {
          message: "Cannot read PKCS#10 certificate request. ASN.1 object is not a PKCS#10 CertificationRequest.",
          errors: N
        }
      }
      if (typeof P.csrSignature !== "string") {
        var L = "\x00";
        for (var J = 0; J < P.csrSignature.length; ++J) {
          L += t.toDer(P.csrSignature[J]).getBytes()
        }
        P.csrSignature = L
      }
      var H = t.derToOid(P.publicKeyOid);
      if (H !== j.oids.rsaEncryption) {
        throw {
          message: "Cannot read public key. OID is not RSA."
        }
      }
      var K = j.createCertificationRequest();
      K.version = P.csrVersion ? P.csrVersion.charCodeAt(0) : 0;
      K.signatureOid = p.asn1.derToOid(P.csrSignatureOid);
      K.signatureParameters = g(K.signatureOid, P.csrSignatureParams, true);
      K.siginfo.algorithmOid = p.asn1.derToOid(P.csrSignatureOid);
      K.siginfo.parameters = g(K.siginfo.algorithmOid, P.csrSignatureParams, false);
      var G = p.util.createBuffer(P.csrSignature);
      ++G.read;
      K.signature = G.getBytes();
      K.certificationRequestInfo = P.certificationRequestInfo;
      if (O) {
        K.md = null;
        if (K.signatureOid in m) {
          var H = m[K.signatureOid];
          switch (H) {
            case "sha1withRSAEncryption":
              K.md = p.md.sha1.create();
              break;
            case "md5withRSAEncryption":
              K.md = p.md.md5.create();
              break;
            case "sha256WithRSAEncryption":
              K.md = p.md.sha256.create();
              break;
            case "RSASSA-PSS":
              K.md = p.md.sha256.create();
              break
          }
        }
        if (K.md === null) {
          throw {
            message: "Could not compute certification request digest. Unknown signature OID.",
            signatureOid: K.signatureOid
          }
        }
        var Q = t.toDer(K.certificationRequestInfo);
        K.md.update(Q.getBytes())
      }
      var M = p.md.sha1.create();
      K.subject.getField = function (R) {
        return i(K.subject, R)
      };
      K.subject.addField = function (R) {
        _fillMissingFields([R]);
        K.subject.attributes.push(R)
      };
      K.subject.attributes = j.RDNAttributesAsArray(P.certificationRequestInfoSubject, M);
      K.subject.hash = M.digest().toHex();
      K.publicKey = j.publicKeyFromAsn1(P.subjectPublicKeyInfo);
      K.getAttribute = function (R) {
        return i(K.attributes, R)
      };
      K.addAttribute = function (R) {
        _fillMissingFields([R]);
        K.attributes.push(R)
      };
      K.attributes = j.CRIAttributesAsArray(P.certificationRequestInfoAttributes);
      return K
    };
    j.createCertificationRequest = function () {
      var G = {};
      G.version = 0;
      G.signatureOid = null;
      G.signature = null;
      G.siginfo = {};
      G.siginfo.algorithmOid = null;
      G.subject = {};
      G.subject.getField = function (I) {
        return i(G.subject, I)
      };
      G.subject.addField = function (I) {
        H([I]);
        G.subject.attributes.push(I)
      };
      G.subject.attributes = [];
      G.subject.hash = null;
      G.publicKey = null;
      G.attributes = [];
      G.getAttribute = function (I) {
        return i(G.attributes, I)
      };
      G.addAttribute = function (I) {
        H([I]);
        G.attributes.push(I)
      };
      G.md = null;
      var H = function (J) {
        var I;
        for (var K = 0; K < J.length; ++K) {
          I = J[K];
          if (typeof (I.name) === "undefined") {
            if (I.type && I.type in j.oids) {
              I.name = j.oids[I.type]
            } else {
              if (I.shortName && I.shortName in w) {
                I.name = j.oids[w[I.shortName]]
              }
            }
          }
          if (typeof (I.type) === "undefined") {
            if (I.name && I.name in j.oids) {
              I.type = j.oids[I.name]
            } else {
              throw {
                message: "Attribute type not specified.",
                attribute: I
              }
            }
          }
          if (typeof (I.shortName) === "undefined") {
            if (I.name && I.name in w) {
              I.shortName = w[I.name]
            }
          }
          if (typeof (I.value) === "undefined") {
            throw {
              message: "Attribute value not specified.",
              attribute: I
            }
          }
        }
      };
      G.setSubject = function (I) {
        H(I);
        G.subject.attributes = I;
        G.subject.hash = null
      };
      G.setAttributes = function (I) {
        H(I);
        G.attributes = I
      };
      G.sign = function (J) {
        G.signatureOid = m.sha1withRSAEncryption;
        G.siginfo.algorithmOid = m.sha1withRSAEncryption;
        G.md = p.md.sha1.create();
        G.certificationRequestInfo = j.getCertificationRequestInfo(G);
        var I = t.toDer(G.certificationRequestInfo);
        G.md.update(I.getBytes());
        G.signature = J.sign(G.md)
      };
      G.verify = function () {
        var P = false;
        var M = G.md;
        if (M === null) {
          if (G.signatureOid in m) {
            var L = m[G.signatureOid];
            switch (L) {
              case "sha1withRSAEncryption":
                M = p.md.sha1.create();
                break;
              case "md5withRSAEncryption":
                M = p.md.md5.create();
                break;
              case "sha256WithRSAEncryption":
                M = p.md.sha256.create();
                break;
              case "RSASSA-PSS":
                M = p.md.sha256.create();
                break
            }
          }
          if (M === null) {
            throw {
              message: "Could not compute certification request digest. Unknown signature OID.",
              signatureOid: G.signatureOid
            }
          }
          var J = G.certificationRequestInfo || j.getCertificationRequestInfo(G);
          var I = t.toDer(J);
          M.update(I.getBytes())
        }
        if (M !== null) {
          var K = undefined;
          switch (G.signatureOid) {
            case m.sha1withRSAEncryption:
              K = undefined;
              break;
            case m["RSASSA-PSS"]:
              var O, N;
              O = m[G.signatureParameters.mgf.hash.algorithmOid];
              if (O === undefined || p.md[O] === undefined) {
                throw {
                  message: "Unsupported MGF hash function.",
                  oid: G.signatureParameters.mgf.hash.algorithmOid,
                  name: O
                }
              }
              N = m[G.signatureParameters.mgf.algorithmOid];
              if (N === undefined || p.mgf[N] === undefined) {
                throw {
                  message: "Unsupported MGF function.",
                  oid: G.signatureParameters.mgf.algorithmOid,
                  name: N
                }
              }
              N = p.mgf[N].create(p.md[O].create());
              O = m[G.signatureParameters.hash.algorithmOid];
              if (O === undefined || p.md[O] === undefined) {
                throw {
                  message: "Unsupported RSASSA-PSS hash function.",
                  oid: G.signatureParameters.hash.algorithmOid,
                  name: O
                }
              }
              K = p.pss.create(p.md[O].create(), N, G.signatureParameters.saltLength);
              break
          }
          P = G.publicKey.verify(M.digest().getBytes(), G.signature, K)
        }
        return P
      };
      return G
    };

    function n(M) {
      var L = t.create(t.Class.UNIVERSAL, t.Type.SEQUENCE, true, []);
      var G, N;
      var H = M.attributes;
      for (var I = 0; I < H.length; ++I) {
        G = H[I];
        var K = G.value;
        var J = t.Type.PRINTABLESTRING;
        if ("valueTagClass" in G) {
          J = G.valueTagClass;
          if (J === t.Type.UTF8) {
            K = p.util.encodeUtf8(K)
          }
        }
        N = t.create(t.Class.UNIVERSAL, t.Type.SET, true, [t.create(t.Class.UNIVERSAL, t.Type.SEQUENCE, true, [t.create(t.Class.UNIVERSAL, t.Type.OID, false, t.oidToDer(G.type).getBytes()), t.create(t.Class.UNIVERSAL, J, false, K)])]);
        L.value.push(N)
      }
      return L
    }

    function h(J) {
      var M = t.create(t.Class.CONTEXT_SPECIFIC, 3, true, []);
      var H = t.create(t.Class.UNIVERSAL, t.Type.SEQUENCE, true, []);
      M.value.push(H);
      var K, G;
      for (var I = 0; I < J.length; ++I) {
        K = J[I];
        G = t.create(t.Class.UNIVERSAL, t.Type.SEQUENCE, true, []);
        H.value.push(G);
        G.value.push(t.create(t.Class.UNIVERSAL, t.Type.OID, false, t.oidToDer(K.id).getBytes()));
        if (K.critical) {
          G.value.push(t.create(t.Class.UNIVERSAL, t.Type.BOOLEAN, false, String.fromCharCode(255)))
        }
        var L = K.value;
        if (typeof K.value !== "string") {
          L = t.toDer(L).getBytes()
        }
        G.value.push(t.create(t.Class.UNIVERSAL, t.Type.OCTETSTRING, false, L))
      }
      return M
    }

    function B(G, I) {
      switch (G) {
        case m["RSASSA-PSS"]:
          var H = [];
          if (I.hash.algorithmOid !== undefined) {
            H.push(t.create(t.Class.CONTEXT_SPECIFIC, 0, true, [t.create(t.Class.UNIVERSAL, t.Type.SEQUENCE, true, [t.create(t.Class.UNIVERSAL, t.Type.OID, false, t.oidToDer(I.hash.algorithmOid).getBytes()), t.create(t.Class.UNIVERSAL, t.Type.NULL, false, "")])]))
          }
          if (I.mgf.algorithmOid !== undefined) {
            H.push(t.create(t.Class.CONTEXT_SPECIFIC, 1, true, [t.create(t.Class.UNIVERSAL, t.Type.SEQUENCE, true, [t.create(t.Class.UNIVERSAL, t.Type.OID, false, t.oidToDer(I.mgf.algorithmOid).getBytes()), t.create(t.Class.UNIVERSAL, t.Type.SEQUENCE, true, [t.create(t.Class.UNIVERSAL, t.Type.OID, false, t.oidToDer(I.mgf.hash.algorithmOid).getBytes()), t.create(t.Class.UNIVERSAL, t.Type.NULL, false, "")])])]))
          }
          if (I.saltLength !== undefined) {
            H.push(t.create(t.Class.CONTEXT_SPECIFIC, 2, true, [t.create(t.Class.UNIVERSAL, t.Type.INTEGER, false, String.fromCharCode(I.saltLength))]))
          }
          return t.create(t.Class.UNIVERSAL, t.Type.SEQUENCE, true, H);
        default:
          return t.create(t.Class.UNIVERSAL, t.Type.NULL, false, "")
      }
    }

    function E(K) {
      var N = t.create(t.Class.CONTEXT_SPECIFIC, 0, true, []);
      if (K.attributes.length === 0) {
        return N
      }
      var I = K.attributes;
      for (var J = 0; J < I.length; ++J) {
        var G = I[J];
        var M = G.value;
        var L = t.Type.UTF8;
        if ("valueTagClass" in G) {
          L = G.valueTagClass
        }
        if (L === t.Type.UTF8) {
          M = p.util.encodeUtf8(M)
        }
        var H = t.create(t.Class.UNIVERSAL, t.Type.SEQUENCE, true, [t.create(t.Class.UNIVERSAL, t.Type.OID, false, t.oidToDer(G.type).getBytes()), t.create(t.Class.UNIVERSAL, t.Type.SET, true, [t.create(t.Class.UNIVERSAL, L, false, M)])]);
        N.value.push(H)
      }
      return N
    }
    j.getTBSCertificate = function (H) {
      var G = t.create(t.Class.UNIVERSAL, t.Type.SEQUENCE, true, [t.create(t.Class.CONTEXT_SPECIFIC, 0, true, [t.create(t.Class.UNIVERSAL, t.Type.INTEGER, false, String.fromCharCode(H.version))]), t.create(t.Class.UNIVERSAL, t.Type.INTEGER, false, p.util.hexToBytes(H.serialNumber)), t.create(t.Class.UNIVERSAL, t.Type.SEQUENCE, true, [t.create(t.Class.UNIVERSAL, t.Type.OID, false, t.oidToDer(H.siginfo.algorithmOid).getBytes()), B(H.siginfo.algorithmOid, H.siginfo.parameters)]), n(H.issuer), t.create(t.Class.UNIVERSAL, t.Type.SEQUENCE, true, [t.create(t.Class.UNIVERSAL, t.Type.UTCTIME, false, t.dateToUtcTime(H.validity.notBefore)), t.create(t.Class.UNIVERSAL, t.Type.UTCTIME, false, t.dateToUtcTime(H.validity.notAfter))]), n(H.subject), j.publicKeyToAsn1(H.publicKey)]);
      if (H.issuer.uniqueId) {
        G.value.push(t.create(t.Class.CONTEXT_SPECIFIC, 1, true, [t.create(t.Class.UNIVERSAL, t.Type.BITSTRING, false, String.fromCharCode(0) + H.issuer.uniqueId)]))
      }
      if (H.subject.uniqueId) {
        G.value.push(t.create(t.Class.CONTEXT_SPECIFIC, 2, true, [t.create(t.Class.UNIVERSAL, t.Type.BITSTRING, false, String.fromCharCode(0) + H.subject.uniqueId)]))
      }
      if (H.extensions.length > 0) {
        G.value.push(h(H.extensions))
      }
      return G
    };
    j.getCertificationRequestInfo = function (H) {
      var G = t.create(t.Class.UNIVERSAL, t.Type.SEQUENCE, true, [t.create(t.Class.UNIVERSAL, t.Type.INTEGER, false, String.fromCharCode(H.version)), n(H.subject), j.publicKeyToAsn1(H.publicKey), E(H)]);
      return G
    };
    j.distinguishedNameToAsn1 = function (G) {
      return n(G)
    };
    j.certificateToAsn1 = function (H) {
      var G = H.tbsCertificate || j.getTBSCertificate(H);
      return t.create(t.Class.UNIVERSAL, t.Type.SEQUENCE, true, [G, t.create(t.Class.UNIVERSAL, t.Type.SEQUENCE, true, [t.create(t.Class.UNIVERSAL, t.Type.OID, false, t.oidToDer(H.signatureOid).getBytes()), B(H.signatureOid, H.signatureParameters)]), t.create(t.Class.UNIVERSAL, t.Type.BITSTRING, false, String.fromCharCode(0) + H.signature)])
    };
    j.certificationRequestToAsn1 = function (H) {
      var G = H.certificationRequestInfo || j.getCertificationRequestInfo(H);
      return t.create(t.Class.UNIVERSAL, t.Type.SEQUENCE, true, [G, t.create(t.Class.UNIVERSAL, t.Type.SEQUENCE, true, [t.create(t.Class.UNIVERSAL, t.Type.OID, false, t.oidToDer(H.signatureOid).getBytes()), B(H.signatureOid, H.signatureParameters)]), t.create(t.Class.UNIVERSAL, t.Type.BITSTRING, false, String.fromCharCode(0) + H.signature)])
    };
    j.createCaStore = function (J) {
      var I = {
        certs: {}
      };
      I.getIssuer = function (K) {
        var M = null;
        if (!K.issuer.hash) {
          var L = p.md.sha1.create();
          K.issuer.attributes = j.RDNAttributesAsArray(n(K.issuer), L);
          K.issuer.hash = L.digest().toHex()
        }
        if (K.issuer.hash in I.certs) {
          M = I.certs[K.issuer.hash];
          if (p.util.isArray(M)) {
            throw {
              message: "Resolving multiple issuer matches not implemented yet."
            }
          }
        }
        return M
      };
      I.addCertificate = function (L) {
        if (typeof L === "string") {
          L = p.pki.certificateFromPem(L)
        }
        if (!L.subject.hash) {
          var M = p.md.sha1.create();
          L.subject.attributes = j.RDNAttributesAsArray(n(L.subject), M);
          L.subject.hash = M.digest().toHex()
        }
        if (L.subject.hash in I.certs) {
          var K = I.certs[L.subject.hash];
          if (!p.util.isArray(K)) {
            K = [K]
          }
          K.push(L)
        } else {
          I.certs[L.subject.hash] = L
        }
      };
      if (J) {
        for (var H = 0; H < J.length; ++H) {
          var G = J[H];
          I.addCertificate(G)
        }
      }
      return I
    };
    j.certificateError = {
      bad_certificate: "forge.pki.BadCertificate",
      unsupported_certificate: "forge.pki.UnsupportedCertificate",
      certificate_revoked: "forge.pki.CertificateRevoked",
      certificate_expired: "forge.pki.CertificateExpired",
      certificate_unknown: "forge.pki.CertificateUnknown",
      unknown_ca: "forge.pki.UnknownCertificateAuthority"
    };
    j.verifyCertificateChain = function (M, O, G) {
      O = O.slice(0);
      var I = O.slice(0);
      var H = new Date();
      var K = true;
      var Q = null;
      var Y = 0;
      var L = null;
      do {
        var W = O.shift();
        if (H < W.validity.notBefore || H > W.validity.notAfter) {
          Q = {
            message: "Certificate is not valid yet or has expired.",
            error: j.certificateError.certificate_expired,
            notBefore: W.validity.notBefore,
            notAfter: W.validity.notAfter,
            now: H
          }
        } else {
          var P = false;
          if (O.length > 0) {
            L = O[0];
            try {
              P = L.verify(W)
            } catch (T) { }
          } else {
            var V = M.getIssuer(W);
            if (V === null) {
              Q = {
                message: "Certificate is not trusted.",
                error: j.certificateError.unknown_ca
              }
            } else {
              if (!p.util.isArray(V)) {
                V = [V]
              }
              while (!P && V.length > 0) {
                L = V.shift();
                try {
                  P = L.verify(W)
                } catch (T) { }
              }
            }
          }
          if (Q === null && !P) {
            Q = {
              message: "Certificate signature is invalid.",
              error: j.certificateError.bad_certificate
            }
          }
        }
        if (Q === null && !W.isIssuer(L)) {
          Q = {
            message: "Certificate issuer is invalid.",
            error: j.certificateError.bad_certificate
          }
        }
        if (Q === null) {
          var Z = {
            keyUsage: true,
            basicConstraints: true
          };
          for (var S = 0; Q === null && S < W.extensions.length; ++S) {
            var J = W.extensions[S];
            if (J.critical && !(J.name in Z)) {
              Q = {
                message: "Certificate has an unsupported critical extension.",
                error: j.certificateError.unsupported_certificate
              }
            }
          }
        }
        if (!K || (O.length === 0 && !L)) {
          var R = W.getExtension("basicConstraints");
          var N = W.getExtension("keyUsage");
          if (N !== null) {
            if (!N.keyCertSign || R === null) {
              Q = {
                message: "Certificate keyUsage or basicConstraints conflict or indicate that the certificate is not a CA. If the certificate is the only one in the chain or isn't the first then the certificate must be a valid CA.",
                error: j.certificateError.bad_certificate
              }
            }
          }
          if (Q === null && R !== null && !R.cA) {
            Q = {
              message: "Certificate basicConstraints indicates the certificate is not a CA.",
              error: j.certificateError.bad_certificate
            }
          }
        }
        var U = (Q === null) ? true : Q.error;
        var X = G ? G(U, Y, I) : U;
        if (X === true) {
          Q = null
        } else {
          if (U === true) {
            Q = {
              message: "The application rejected the certificate.",
              error: j.certificateError.bad_certificate
            }
          }
          if (X || X === 0) {
            if (typeof X === "object" && !p.util.isArray(X)) {
              if (X.message) {
                Q.message = X.message
              }
              if (X.error) {
                Q.error = X.error
              }
            } else {
              if (typeof X === "string") {
                Q.error = X
              }
            }
          }
          throw Q
        }
        K = false;
        ++Y
      } while (O.length > 0);
      return true
    };
    j.publicKeyFromAsn1 = function (J) {
      var G = {};
      var L = [];
      if (t.validate(J, A, G, L)) {
        var H = t.derToOid(G.publicKeyOid);
        if (H !== j.oids.rsaEncryption) {
          throw {
            message: "Cannot read public key. Unknown OID.",
            oid: H
          }
        }
        J = G.rsaPublicKey
      }
      L = [];
      if (!t.validate(J, v, G, L)) {
        throw {
          message: "Cannot read public key. ASN.1 object does not contain an RSAPublicKey.",
          errors: L
        }
      }
      var K = p.util.createBuffer(G.publicKeyModulus).toHex();
      var I = p.util.createBuffer(G.publicKeyExponent).toHex();
      return j.setRsaPublicKey(new BigInteger(K, 16), new BigInteger(I, 16))
    };
    j.publicKeyToAsn1 = j.publicKeyToSubjectPublicKeyInfo = function (G) {
      return t.create(t.Class.UNIVERSAL, t.Type.SEQUENCE, true, [t.create(t.Class.UNIVERSAL, t.Type.SEQUENCE, true, [t.create(t.Class.UNIVERSAL, t.Type.OID, false, t.oidToDer(j.oids.rsaEncryption).getBytes()), t.create(t.Class.UNIVERSAL, t.Type.NULL, false, "")]), t.create(t.Class.UNIVERSAL, t.Type.BITSTRING, false, [j.publicKeyToRSAPublicKey(G)])])
    };
    j.publicKeyToRSAPublicKey = function (G) {
      return t.create(t.Class.UNIVERSAL, t.Type.SEQUENCE, true, [t.create(t.Class.UNIVERSAL, t.Type.INTEGER, false, r(G.n)), t.create(t.Class.UNIVERSAL, t.Type.INTEGER, false, r(G.e))])
    };
    j.privateKeyFromAsn1 = function (J) {
      var P = {};
      var O = [];
      if (t.validate(J, s, P, O)) {
        J = t.fromDer(p.util.createBuffer(P.privateKey))
      }
      P = {};
      O = [];
      if (!t.validate(J, z, P, O)) {
        throw {
          message: "Cannot read private key. ASN.1 object does not contain an RSAPrivateKey.",
          errors: O
        }
      }
      var I, K, L, H, G, N, M, Q;
      I = p.util.createBuffer(P.privateKeyModulus).toHex();
      K = p.util.createBuffer(P.privateKeyPublicExponent).toHex();
      L = p.util.createBuffer(P.privateKeyPrivateExponent).toHex();
      H = p.util.createBuffer(P.privateKeyPrime1).toHex();
      G = p.util.createBuffer(P.privateKeyPrime2).toHex();
      N = p.util.createBuffer(P.privateKeyExponent1).toHex();
      M = p.util.createBuffer(P.privateKeyExponent2).toHex();
      Q = p.util.createBuffer(P.privateKeyCoefficient).toHex();
      return j.setRsaPrivateKey(new BigInteger(I, 16), new BigInteger(K, 16), new BigInteger(L, 16), new BigInteger(H, 16), new BigInteger(G, 16), new BigInteger(N, 16), new BigInteger(M, 16), new BigInteger(Q, 16))
    };
    j.privateKeyToAsn1 = j.privateKeyToRSAPrivateKey = function (G) {
      return t.create(t.Class.UNIVERSAL, t.Type.SEQUENCE, true, [t.create(t.Class.UNIVERSAL, t.Type.INTEGER, false, String.fromCharCode(0)), t.create(t.Class.UNIVERSAL, t.Type.INTEGER, false, r(G.n)), t.create(t.Class.UNIVERSAL, t.Type.INTEGER, false, r(G.e)), t.create(t.Class.UNIVERSAL, t.Type.INTEGER, false, r(G.d)), t.create(t.Class.UNIVERSAL, t.Type.INTEGER, false, r(G.p)), t.create(t.Class.UNIVERSAL, t.Type.INTEGER, false, r(G.q)), t.create(t.Class.UNIVERSAL, t.Type.INTEGER, false, r(G.dP)), t.create(t.Class.UNIVERSAL, t.Type.INTEGER, false, r(G.dQ)), t.create(t.Class.UNIVERSAL, t.Type.INTEGER, false, r(G.qInv))])
    };
    j.wrapRsaPrivateKey = function (G) {
      return t.create(t.Class.UNIVERSAL, t.Type.SEQUENCE, true, [t.create(t.Class.UNIVERSAL, t.Type.INTEGER, false, "\x00"), t.create(t.Class.UNIVERSAL, t.Type.SEQUENCE, true, [t.create(t.Class.UNIVERSAL, t.Type.OID, false, t.oidToDer(m.rsaEncryption).getBytes()), t.create(t.Class.UNIVERSAL, t.Type.NULL, false, "")]), t.create(t.Class.UNIVERSAL, t.Type.OCTETSTRING, false, t.toDer(G).getBytes())])
    };
    j.encryptPrivateKeyInfo = function (J, R, T) {
      T = T || {};
      T.saltSize = T.saltSize || 8;
      T.count = T.count || 2048;
      T.algorithm = T.algorithm || "aes128";
      var L = p.random.getBytes(T.saltSize);
      var P = T.count;
      var Q = p.util.createBuffer();
      Q.putInt16(P);
      var U;
      var M;
      var G;
      if (T.algorithm.indexOf("aes") === 0) {
        var S;
        if (T.algorithm === "aes128") {
          U = 16;
          S = m["aes128-CBC"]
        } else {
          if (T.algorithm === "aes192") {
            U = 24;
            S = m["aes192-CBC"]
          } else {
            if (T.algorithm === "aes256") {
              U = 32;
              S = m["aes256-CBC"]
            } else {
              throw {
                message: "Cannot encrypt private key. Unknown encryption algorithm.",
                algorithm: T.algorithm
              }
            }
          }
        }
        var O = p.pkcs5.pbkdf2(R, L, P, U);
        var H = p.random.getBytes(16);
        var N = p.aes.createEncryptionCipher(O);
        N.start(H);
        N.update(t.toDer(J));
        N.finish();
        G = N.output.getBytes();
        M = t.create(t.Class.UNIVERSAL, t.Type.SEQUENCE, true, [t.create(t.Class.UNIVERSAL, t.Type.OID, false, t.oidToDer(m.pkcs5PBES2).getBytes()), t.create(t.Class.UNIVERSAL, t.Type.SEQUENCE, true, [t.create(t.Class.UNIVERSAL, t.Type.SEQUENCE, true, [t.create(t.Class.UNIVERSAL, t.Type.OID, false, t.oidToDer(m.pkcs5PBKDF2).getBytes()), t.create(t.Class.UNIVERSAL, t.Type.SEQUENCE, true, [t.create(t.Class.UNIVERSAL, t.Type.OCTETSTRING, false, L), t.create(t.Class.UNIVERSAL, t.Type.INTEGER, false, Q.getBytes())])]), t.create(t.Class.UNIVERSAL, t.Type.SEQUENCE, true, [t.create(t.Class.UNIVERSAL, t.Type.OID, false, t.oidToDer(S).getBytes()), t.create(t.Class.UNIVERSAL, t.Type.OCTETSTRING, false, H)])])])
      } else {
        if (T.algorithm === "3des") {
          U = 24;
          var I = new p.util.ByteBuffer(L);
          var O = p.pkcs12.generateKey(R, I, 1, P, U);
          var H = p.pkcs12.generateKey(R, I, 2, P, U);
          var N = p.des.createEncryptionCipher(O);
          N.start(H);
          N.update(t.toDer(J));
          N.finish();
          G = N.output.getBytes();
          M = t.create(t.Class.UNIVERSAL, t.Type.SEQUENCE, true, [t.create(t.Class.UNIVERSAL, t.Type.OID, false, t.oidToDer(m["pbeWithSHAAnd3-KeyTripleDES-CBC"]).getBytes()), t.create(t.Class.UNIVERSAL, t.Type.SEQUENCE, true, [t.create(t.Class.UNIVERSAL, t.Type.OCTETSTRING, false, L), t.create(t.Class.UNIVERSAL, t.Type.INTEGER, false, Q.getBytes())])])
        } else {
          throw {
            message: "Cannot encrypt private key. Unknown encryption algorithm.",
            algorithm: T.algorithm
          }
        }
      }
      var K = t.create(t.Class.UNIVERSAL, t.Type.SEQUENCE, true, [M, t.create(t.Class.UNIVERSAL, t.Type.OCTETSTRING, false, G)]);
      return K
    };
    j.pbe.getCipherForPBES2 = function (G, I, O) {
      var P = {};
      var N = [];
      if (!t.validate(I, C, P, N)) {
        throw {
          message: "Cannot read password-based-encryption algorithm parameters. ASN.1 object is not a supported EncryptedPrivateKeyInfo.",
          errors: N
        }
      }
      G = t.derToOid(P.kdfOid);
      if (G !== j.oids.pkcs5PBKDF2) {
        throw {
          message: "Cannot read encrypted private key. Unsupported key derivation function OID.",
          oid: G,
          supportedOids: ["pkcs5PBKDF2"]
        }
      }
      G = t.derToOid(P.encOid);
      if (G !== j.oids["aes128-CBC"] && G !== j.oids["aes192-CBC"] && G !== j.oids["aes256-CBC"]) {
        throw {
          message: "Cannot read encrypted private key. Unsupported encryption scheme OID.",
          oid: G,
          supportedOids: ["aes128-CBC", "aes192-CBC", "aes256-CBC"]
        }
      }
      var J = P.kdfSalt;
      var M = p.util.createBuffer(P.kdfIterationCount);
      M = M.getInt(M.length() << 3);
      var Q;
      if (G === j.oids["aes128-CBC"]) {
        Q = 16
      } else {
        if (G === j.oids["aes192-CBC"]) {
          Q = 24
        } else {
          if (G === j.oids["aes256-CBC"]) {
            Q = 32
          }
        }
      }
      var L = p.pkcs5.pbkdf2(O, J, M, Q);
      var H = P.encIv;
      var K = p.aes.createDecryptionCipher(L);
      K.start(H);
      return K
    };
    j.pbe.getCipherForPKCS12PBE = function (H, J, P) {
      var Q = {};
      var M = [];
      if (!t.validate(J, F, Q, M)) {
        throw {
          message: "Cannot read password-based-encryption algorithm parameters. ASN.1 object is not a supported EncryptedPrivateKeyInfo.",
          errors: M
        }
      }
      var K = p.util.createBuffer(Q.salt);
      var L = p.util.createBuffer(Q.iterations);
      L = L.getInt(L.length() << 3);
      var R, G, O;
      switch (H) {
        case j.oids["pbeWithSHAAnd3-KeyTripleDES-CBC"]:
          R = 24;
          G = 8;
          O = p.des.startDecrypting;
          break;
        case j.oids["pbewithSHAAnd40BitRC2-CBC"]:
          R = 5;
          G = 8;
          O = function (U, T) {
            var S = p.rc2.createDecryptionCipher(U, 40);
            S.start(T, null);
            return S
          };
          break;
        default:
          throw {
            message: "Cannot read PKCS #12 PBE data block. Unsupported OID.", oid: H
          }
      }
      var N = p.pkcs12.generateKey(P, K, 1, L, R);
      var I = p.pkcs12.generateKey(P, K, 2, L, G);
      return O(N, I)
    };
    j.pbe.getCipher = function (H, I, G) {
      switch (H) {
        case j.oids.pkcs5PBES2:
          return j.pbe.getCipherForPBES2(H, I, G);
          break;
        case j.oids["pbeWithSHAAnd3-KeyTripleDES-CBC"]:
        case j.oids["pbewithSHAAnd40BitRC2-CBC"]:
          return j.pbe.getCipherForPKCS12PBE(H, I, G);
          break;
        default:
          throw {
            message: "Cannot read encrypted PBE data block. Unsupported OID.", oid: H, supportedOids: ["pkcs5PBES2", "pbeWithSHAAnd3-KeyTripleDES-CBC", "pbewithSHAAnd40BitRC2-CBC"]
          }
      }
    };
    j.decryptPrivateKeyInfo = function (M, I) {
      var L = null;
      var H = {};
      var N = [];
      if (!t.validate(M, y, H, N)) {
        throw {
          message: "Cannot read encrypted private key. ASN.1 object is not a supported EncryptedPrivateKeyInfo.",
          errors: N
        }
      }
      var J = t.derToOid(H.encryptionOid);
      var G = j.pbe.getCipher(J, H.encryptionParams, I);
      var K = p.util.createBuffer(H.encryptedData);
      G.update(K);
      if (G.finish()) {
        L = t.fromDer(G.output)
      }
      return L
    };
    j.encryptedPrivateKeyToPem = function (G, I) {
      var H = {
        type: "ENCRYPTED PRIVATE KEY",
        body: t.toDer(G).getBytes()
      };
      return p.pem.encode(H, {
        maxline: I
      })
    };
    j.encryptedPrivateKeyFromPem = function (G) {
      var H = p.pem.decode(G)[0];
      if (H.type !== "ENCRYPTED PRIVATE KEY") {
        throw {
          message: 'Could not convert encrypted private key from PEM; PEM header type is "ENCRYPTED PRIVATE KEY".',
          headerType: H.type
        }
      }
      if (H.procType && H.procType.type === "ENCRYPTED") {
        throw {
          message: "Could not convert encrypted private key from PEM; PEM is encrypted."
        }
      }
      return t.fromDer(H.body)
    };
    j.encryptRsaPrivateKey = function (L, N, P) {
      P = P || {};
      if (!P.legacy) {
        var I = j.wrapRsaPrivateKey(j.privateKeyToAsn1(L));
        I = j.encryptPrivateKeyInfo(I, N, P);
        return j.encryptedPrivateKeyToPem(I)
      }
      var M;
      var H;
      var Q;
      var O;
      switch (P.algorithm) {
        case "aes128":
          M = "AES-128-CBC";
          Q = 16;
          H = p.random.getBytes(16);
          O = p.aes.createEncryptionCipher;
          break;
        case "aes192":
          M = "AES-192-CBC";
          Q = 24;
          H = p.random.getBytes(16);
          O = p.aes.createEncryptionCipher;
          break;
        case "aes256":
          M = "AES-256-CBC";
          Q = 32;
          H = p.random.getBytes(16);
          O = p.aes.createEncryptionCipher;
          break;
        case "3des":
          M = "DES-EDE3-CBC";
          Q = 24;
          H = p.random.getBytes(8);
          O = p.des.createEncryptionCipher;
          break;
        default:
          throw {
            message: 'Could not encrypt RSA private key; unsupported encryption algorithm "' + P.algorithm + '".', algorithm: P.algorithm
          }
      }
      var K = D(N, H.substr(0, 8), Q);
      var J = O(K);
      J.start(H);
      J.update(t.toDer(j.privateKeyToAsn1(L)));
      J.finish();
      var G = {
        type: "RSA PRIVATE KEY",
        procType: {
          version: "4",
          type: "ENCRYPTED"
        },
        dekInfo: {
          algorithm: M,
          parameters: p.util.bytesToHex(H).toUpperCase()
        },
        body: J.output.getBytes()
      };
      return p.pem.encode(G)
    };
    j.decryptRsaPrivateKey = function (J, M) {
      var I = null;
      var G = p.pem.decode(J)[0];
      if (G.type !== "ENCRYPTED PRIVATE KEY" && G.type !== "PRIVATE KEY" && G.type !== "RSA PRIVATE KEY") {
        throw {
          message: 'Could not convert private key from PEM; PEM header type is not "ENCRYPTED PRIVATE KEY", "PRIVATE KEY", or "RSA PRIVATE KEY".',
          headerType: G.type
        }
      }
      if (G.procType && G.procType.type === "ENCRYPTED") {
        var O;
        var N;
        switch (G.dekInfo.algorithm) {
          case "DES-EDE3-CBC":
            O = 24;
            N = p.des.createDecryptionCipher;
            break;
          case "AES-128-CBC":
            O = 16;
            N = p.aes.createDecryptionCipher;
            break;
          case "AES-192-CBC":
            O = 24;
            N = p.aes.createDecryptionCipher;
            break;
          case "AES-256-CBC":
            O = 32;
            N = p.aes.createDecryptionCipher;
            break;
          case "RC2-40-CBC":
            O = 5;
            N = function (P) {
              return p.rc2.createDecryptionCipher(P, 40)
            };
            break;
          case "RC2-64-CBC":
            O = 8;
            N = function (P) {
              return p.rc2.createDecryptionCipher(P, 64)
            };
            break;
          case "RC2-128-CBC":
            O = 16;
            N = function (P) {
              return p.rc2.createDecryptionCipher(P, 128)
            };
            break;
          default:
            throw {
              message: 'Could not decrypt private key; unsupported encryption algorithm "' + G.dekInfo.algorithm + '".', algorithm: G.dekInfo.algorithm
            }
        }
        var H = p.util.hexToBytes(G.dekInfo.parameters);
        var L = D(M, H.substr(0, 8), O);
        var K = N(L);
        K.start(H);
        K.update(p.util.createBuffer(G.body));
        if (K.finish()) {
          I = K.output.getBytes()
        } else {
          return I
        }
      } else {
        I = G.body
      }
      if (G.type === "ENCRYPTED PRIVATE KEY") {
        I = j.decryptPrivateKeyInfo(t.fromDer(I), M)
      } else {
        I = t.fromDer(I)
      }
      if (I !== null) {
        I = j.privateKeyFromAsn1(I)
      }
      return I
    };

    function D(H, J, G) {
      var L = [l(H + J)];
      for (var K = 16, I = 1; K < G; ++I, K += 16) {
        L.push(l(L[I - 1] + H + J))
      }
      return L.join("").substr(0, G)
    }

    function l(G) {
      return p.md.md5.create().update(G).digest().getBytes()
    }
    j.setRsaPublicKey = j.rsa.setPublicKey;
    j.setRsaPrivateKey = j.rsa.setPrivateKey
  }
  var b = "pki";
  var f = ["./aes", "./asn1", "./des", "./jsbn", "./md", "./mgf", "./oids", "./pem", "./pbkdf2", "./pkcs12", "./pss", "./random", "./rc2", "./rsa", "./util"];
  var e = null;
  if (typeof define !== "function") {
    d(forge);
    return
  }
  var c = ["require", "module"].concat(f);
  var a = function (g, h) {
    h.exports = function (k) {
      var l = f.map(function (i) {
        return g(i)
      }).concat(d);
      k = k || {};
      k.defined = k.defined || {};
      if (k.defined[b]) {
        return k[b]
      }
      k.defined[b] = true;
      for (var j = 0; j < l.length; ++j) {
        l[j](k)
      }
      return k[b]
    }
  };
  if (e) {
    e(c, a)
  } else {
    if (typeof define === "function") {
      define([].concat(c), function () {
        a.apply(null, Array.prototype.slice.call(arguments, 0))
      })
    }
  }
})();
(function () {
  function d(g) {
    var i = g.pem = g.pem || {};
    i.encode = function (n, k) {
      k = k || {};
      var m = "-----BEGIN " + n.type + "-----\r\n";
      var o;
      if (n.procType) {
        o = {
          name: "Proc-Type",
          values: [String(n.procType.version), n.procType.type]
        };
        m += h(o)
      }
      if (n.contentDomain) {
        o = {
          name: "Content-Domain",
          values: [n.contentDomain]
        };
        m += h(o)
      }
      if (n.dekInfo) {
        o = {
          name: "DEK-Info",
          values: [n.dekInfo.algorithm]
        };
        if (n.dekInfo.parameters) {
          o.values.push(n.dekInfo.parameters)
        }
        m += h(o)
      }
      if (n.headers) {
        for (var l = 0; l < n.headers.length; ++l) {
          m += h(n.headers[l])
        }
      }
      if (n.procType) {
        m += "\r\n"
      }
      m += g.util.encode64(n.body, k.maxline || 64) + "\r\n";
      m += "-----END " + n.type + "-----\r\n";
      return m
    };
    i.decode = function (t) {
      var q = [];
      var l = /\s*-----BEGIN ([A-Z0-9- ]+)-----\r?\n([\x21-\x7e\s]+?(?:\r?\n\r?\n))?([:A-Za-z0-9+\/=\s]+?)-----END \1-----/g;
      var s = /([\x21-\x7e]+):\s*([\x21-\x7e\s^:]+)/;
      var w = /\r?\n/;
      var r;
      while (true) {
        r = l.exec(t);
        if (!r) {
          break
        }
        var m = {
          type: r[1],
          procType: null,
          contentDomain: null,
          dekInfo: null,
          headers: [],
          body: g.util.decode64(r[3])
        };
        q.push(m);
        if (!r[2]) {
          continue
        }
        var y = r[2].split(w);
        var v = 0;
        while (r && v < y.length) {
          var x = y[v].replace(/\s+$/, "");
          for (var k = v + 1; k < y.length; ++k) {
            var p = y[k];
            if (!/\s/.test(p[0])) {
              break
            }
            x += p;
            v = k
          }
          r = x.match(s);
          if (r) {
            var o = {
              name: r[1],
              values: []
            };
            var u = r[2].split(",");
            for (var n = 0; n < u.length; ++n) {
              o.values.push(j(u[n]))
            }
            if (!m.procType) {
              if (o.name !== "Proc-Type") {
                throw {
                  message: 'Invalid PEM formatted message. The first encapsulated header must be "Proc-Type".'
                }
              } else {
                if (o.values.length !== 2) {
                  throw {
                    message: 'Invalid PEM formatted message. The "Proc-Type" header must have two subfields.'
                  }
                }
              }
              m.procType = {
                version: u[0],
                type: u[1]
              }
            } else {
              if (!m.contentDomain && o.name === "Content-Domain") {
                m.contentDomain = u[0] || ""
              } else {
                if (!m.dekInfo && o.name === "DEK-Info") {
                  if (o.values.length === 0) {
                    throw {
                      message: 'Invalid PEM formatted message. The "DEK-Info" header must have at least one subfield.'
                    }
                  }
                  m.dekInfo = {
                    algorithm: u[0],
                    parameters: u[1] || null
                  }
                } else {
                  m.headers.push(o)
                }
              }
            }
          } ++v
        }
        if (m.procType === "ENCRYPTED" && !m.dekInfo) {
          throw {
            message: 'Invalid PEM formatted message. The "DEK-Info" header must be present if "Proc-Type" is "ENCRYPTED".'
          }
        }
      }
      if (q.length === 0) {
        throw {
          message: "Invalid PEM formatted message."
        }
      }
      return q
    };

    function h(q) {
      var p = q.name + ": ";
      var k = [];
      for (var l = 0; l < q.values.length; ++l) {
        k.push(q.values[l].replace(/^(\S+\r\n)/, function (s, r) {
          return " " + r
        }))
      }
      p += k.join(",") + "\r\n";
      var n = 0;
      var m = -1;
      for (var l = 0; l < p.length; ++l, ++n) {
        if (n > 65 && m !== -1) {
          var o = p[m];
          if (o === ",") {
            ++m;
            o = " "
          }
          p = p.substr(0, m) + "\r\n" + o + p.substr(m + 1);
          n = (l - m - 1);
          m = -1;
          ++l
        }
        if (p[l] === " " || p[l] === "\t" || p[l] === ",") {
          m = l
        }
      }
      return p
    }

    function j(k) {
      return k.replace(/^\s+/, "")
    }
  }
  var b = "pem";
  var f = ["./util"];
  var e = null;
  if (typeof define !== "function") {
    d(forge);
    return
  }
  var c = ["require", "module"].concat(f);
  var a = function (g, h) {
    h.exports = function (k) {
      var l = f.map(function (i) {
        return g(i)
      }).concat(d);
      k = k || {};
      k.defined = k.defined || {};
      if (k.defined[b]) {
        return k[b]
      }
      k.defined[b] = true;
      for (var j = 0; j < l.length; ++j) {
        l[j](k)
      }
      return k[b]
    }
  };
  if (e) {
    e(c, a)
  } else {
    if (typeof define === "function") {
      define([].concat(c), function () {
        a.apply(null, Array.prototype.slice.call(arguments, 0))
      })
    }
  }
})();

//tls.js (forge)

/**
 * A Javascript implementation of Transport Layer Security (TLS).
 *
 * @author Dave Longley
 *
 * Copyright (c) 2009-2012 Digital Bazaar, Inc.
 */

(function () {
  var N = forge;
  N.tls = {}; /*if(typeof(window)!=="undefined"){var N=window.forge=window.forge||{};N.tls={}}else{if(typeof(module)!=="undefined"&&module.exports){var N={aes:require("./aes"),asn1:require("./asn1"),hmac:require("./hmac"),md:require("./md"),pki:require("./pki"),random:require("./random"),util:require("./util")};N.pki.oids=require("./oids");N.pki.rsa=require("./rsa");module.exports=N.tls={}}}*/
  var O = function (Y, ak, ad, X) {
    var ac = N.util.createBuffer();
    var am = (Y.length >> 1);
    var ag = am + (Y.length & 1);
    var ao = Y.substr(0, ag);
    var al = Y.substr(am, ag);
    var aj = N.util.createBuffer();
    var ae = N.hmac.create();
    ad = ak + ad;
    var aa = Math.ceil(X / 16);
    var ab = Math.ceil(X / 20);
    ae.start("MD5", ao);
    var an = N.util.createBuffer();
    aj.putBytes(ad);
    for (var Z = 0; Z < aa; ++Z) {
      var af = new Date().valueOf();
      ae.start(null, null);
      ae.update(aj.getBytes());
      aj.putBuffer(ae.digest());
      ae.start(null, null);
      ae.update(aj.bytes() + ad);
      an.putBuffer(ae.digest())
    }
    ae.start("SHA1", al);
    var ah = N.util.createBuffer();
    aj.clear();
    aj.putBytes(ad);
    for (var Z = 0; Z < ab; ++Z) {
      ae.start(null, null);
      ae.update(aj.getBytes());
      aj.putBuffer(ae.digest());
      ae.start(null, null);
      ae.update(aj.bytes() + ad);
      ah.putBuffer(ae.digest())
    }
    ac.putBytes(N.util.xorBytes(an.getBytes(), ah.getBytes(), X));
    return ac
  };
  var e = function (Y, Z, X, aa) { }; /* hmac tls */
  var j = function (Z, ab, Y) {
        /*console.log('key '+decode(Z))*/;
    var aa = N.hmac.create();
    aa.start("SHA1", Z);
    var X = N.util.createBuffer();
    X.putInt32(ab[0]);
    X.putInt32(ab[1]);
    X.putByte(Y.type);
    X.putByte(Y.version.major);
    X.putByte(Y.version.minor);
    X.putInt16(Y.length);
    X.putBytes(Y.fragment.bytes()); /*console.log(X.data.toString('hex'));console.log('update');*/
    var tmp = X.getBytes(); /*console.log(decode(tmp));*/
    aa.update(tmp); /*console.log('digest');*/
    var tmp2 = aa.digest().getBytes(); /*console.log(decode(tmp2));*/
    return tmp2
  };
  var I = function (ac, Y, aa) {
    var ab = false;
    try {
      var X = ac.deflate(Y.fragment.getBytes());
      Y.fragment = N.util.createBuffer(X);
      Y.length = X.length;
      ab = true
    } catch (Z) { }
    return ab
  };
  var p = function (ac, Y, aa) {
    var ab = false;
    try {
      var X = ac.inflate(Y.fragment.getBytes());
      Y.fragment = N.util.createBuffer(X);
      Y.length = X.length;
      ab = true
    } catch (Z) { }
    return ab
  };
  var f = function (Y, aa) {
    var ab = false;
    var ac = aa.macFunction(aa.macKey, aa.sequenceNumber, Y);
    Y.fragment.putBytes(ac);
    aa.updateSequenceNumber();
    var Z = aa.cipherState.init ? null : aa.cipherState.iv;
    aa.cipherState.init = true;
    var X = aa.cipherState.cipher;
    X.start(Z);
    X.update(Y.fragment);
    if (X.finish(V)) {
      Y.fragment = X.output;
      Y.length = Y.fragment.length();
      ab = true
    }
    return ab
  };
  var V = function (Z, X, Y) {
    if (!Y) {
      var aa = (X.length() == Z) ? (Z - 1) : (Z - X.length() - 1);
      X.fillWithByte(aa, aa + 1)
    }
    return true
  }; /* decrypt aes 128 */
  var r = function (ac, Z, aa) {
    var ad = true;
    if (aa) {
      var X = Z.length();
      var Y = Z.last();
      for (var ab = X - 1 - Y; ab < X - 1; ++ab) {
        ad = ad && (Z.at(ab) == Y)
      }
      if (ad) {
        Z.truncate(Y + 1)
      }
    }; /*console.log('decrypt 128 cbc');console.log(Z.data.toString('hex'));*/
    return ad
  }; /*decrypt aes*/
  var S = function (ab, ag) {
    /*console.log('data to decrypt ')+console.log(ab.fragment.data.toString('hex'));*/
    var aa = false;
    var Y = ag.cipherState.init ? null : ag.cipherState.iv;
    ag.cipherState.init = true;
    var ad = ag.cipherState.cipher;
    ad.start(Y);
    ad.update(ab.fragment);
    aa = ad.finish(r);
    var af = ag.macLength;
    var ae = "";
    for (var Z = 0; Z < af; ++Z) {
      ae += String.fromCharCode(0)
    }
    var ac = ad.output.length();
    if (ac >= af) {
      ab.fragment = ad.output.getBytes(ac - af);
      ae = ad.output.getBytes(af)
    } else {
      ab.fragment = ad.output.getBytes()
    }
    ab.fragment = N.util.createBuffer(ab.fragment);
    ab.length = ab.fragment.length();
    var X = ag.macFunction(ag.macKey, ag.sequenceNumber, ab);
    ag.updateSequenceNumber(); /*console.log('decrypted fragment ');console.log(ab.fragment.data.toString('hex'));console.log('Mac '+decode(X)+' '+decode(ae));*/
    aa = (X === ae) && aa;
    return aa
  };
  var d = function (Z, Y) {
    var X = 0;
    switch (Y) {
      case 1:
        X = Z.getByte();
        break;
      case 2:
        X = Z.getInt16();
        break;
      case 3:
        X = Z.getInt24();
        break;
      case 4:
        X = Z.getInt32();
        break
    }
    return N.util.createBuffer(Z.getBytes(X))
  };
  var n = function (Y, X, Z) {
    Y.putInt(Z.length(), X << 3);
    Y.putBuffer(Z)
  };
  var g = {};
  g.Version = {
    major: 3,
    minor: 1
  };
  g.MaxFragment = (1 << 14) - 1024;
  g.ConnectionEnd = {
    server: 0,
    client: 1
  };
  g.PRFAlgorithm = {
    tls_prf_sha256: 0
  };
  g.BulkCipherAlgorithm = {
    none: null,
    rc4: 0,
    des3: 1,
    aes: 2
  };
  g.CipherType = {
    stream: 0,
    block: 1,
    aead: 2
  };
  g.MACAlgorithm = {
    none: null,
    hmac_md5: 0,
    hmac_sha1: 1,
    hmac_sha256: 2,
    hmac_sha384: 3,
    hmac_sha512: 4
  };
  g.CompressionMethod = {
    none: 0,
    deflate: 1
  };
  g.ContentType = {
    change_cipher_spec: 20,
    alert: 21,
    handshake: 22,
    application_data: 23
  };
  g.HandshakeType = {
    hello_request: 0,
    client_hello: 1,
    server_hello: 2,
    certificate: 11,
    server_key_exchange: 12,
    certificate_request: 13,
    server_hello_done: 14,
    certificate_verify: 15,
    client_key_exchange: 16,
    finished: 20
  };
  g.Alert = {};
  g.Alert.Level = {
    warning: 1,
    fatal: 2
  };
  g.Alert.Description = {
    close_notify: 0,
    unexpected_message: 10,
    bad_record_mac: 20,
    decryption_failed: 21,
    record_overflow: 22,
    decompression_failure: 30,
    handshake_failure: 40,
    bad_certificate: 42,
    unsupported_certificate: 43,
    certificate_revoked: 44,
    certificate_expired: 45,
    certificate_unknown: 46,
    illegal_parameter: 47,
    unknown_ca: 48,
    access_denied: 49,
    decode_error: 50,
    decrypt_error: 51,
    export_restriction: 60,
    protocol_version: 70,
    insufficient_security: 71,
    internal_error: 80,
    user_canceled: 90,
    no_renegotiation: 100
  };
  g.CipherSuites = {
    TLS_RSA_WITH_AES_128_CBC_SHA: [0x00, 0x2f],
    TLS_RSA_WITH_AES_256_CBC_SHA: [0x00, 0x35],
    TLS_ECDHE_ECDSA_WITH_AES_256_CBC_SHA: [0xc0, 0x0a],
    TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA: [0xc0, 0x14],
    TLS_DHE_RSA_WITH_CAMELLIA_256_CBC_SHA: [0x00, 0x88],
    TLS_DHE_DSS_WITH_CAMELLIA_256_CBC_SHA: [0x00, 0x87],
    TLS_DHE_RSA_WITH_AES_256_CBC_SHA: [0x00, 0x39],
    TLS_DHE_DSS_WITH_AES_256_CBC_SHA: [0x00, 0x38],
    TLS_ECDH_RSA_WITH_AES_256_CBC_SHA: [0xc0, 0x0f],
    TLS_ECDH_ECDSA_WITH_AES_256_CBC_SHA: [0xc0, 0x05],
    TLS_RSA_WITH_CAMELLIA_256_CBC_SHA: [0x00, 0x84],
    TLS_ECDHE_ECDSA_WITH_RC4_128_SHA: [0xc0, 0x07],
    TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA: [0xc0, 0x09],
    TLS_ECDHE_RSA_WITH_RC4_128_SHA: [0xc0, 0x11],
    TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA: [0xc0, 0x13],
    TLS_DHE_RSA_WITH_CAMELLIA_128_CBC_SHA: [0x00, 0x45],
    TLS_DHE_DSS_WITH_CAMELLIA_128_CBC_SHA: [0x00, 0x44],
    TLS_DHE_RSA_WITH_AES_128_CBC_SHA: [0x00, 0x33],
    TLS_DHE_DSS_WITH_AES_128_CBC_SHA: [0x00, 0x32],
    TLS_ECDH_RSA_WITH_RC4_128_SHA: [0xc0, 0x0c],
    TLS_ECDH_RSA_WITH_AES_128_CBC_SHA: [0xc0, 0x0e],
    TLS_ECDH_ECDSA_WITH_RC4_128_SHA: [0xc0, 0x02],
    TLS_ECDH_ECDSA_WITH_AES_128_CBC_SHA: [0xc0, 0x04],
    TLS_RSA_WITH_SEED_CBC_SHA: [0x00, 0x96],
    TLS_RSA_WITH_CAMELLIA_128_CBC_SHA: [0x00, 0x41],
    TLS_RSA_WITH_RC4_128_MD5: [0x00, 0x04],
    TLS_RSA_WITH_RC4_128_SHA: [0x00, 0x05],
    TLS_ECDHE_ECDSA_WITH_3DES_EDE_CBC_SHA: [0xc0, 0x08],
    TLS_ECDHE_RSA_WITH_3DES_EDE_CBC_SHA: [0xc0, 0x12],
    TLS_DHE_RSA_WITH_3DES_EDE_CBC_SHA: [0x00, 0x16],
    TLS_DHE_DSS_WITH_3DES_EDE_CBC_SHA: [0x00, 0x13],
    TLS_ECDH_RSA_WITH_3DES_EDE_CBC_SHA: [0xc0, 0x0d],
    TLS_ECDH_ECDSA_WITH_3DES_EDE_CBC_SHA: [0xc0, 0x03],
    SSL_RSA_FIPS_WITH_3DES_EDE_CBC_SHA: [0xfe, 0xff],
    TLS_RSA_WITH_3DES_EDE_CBC_SHA: [0x00, 0x0a]
  };
  /*
      c.session = {
        serverNameList: [],
        cipherSuite: null,
        compressionMethod: null,
        serverCertificate: null,
        clientCertificate: null,
        md5: forge.md.md5.create(),
        sha1: forge.md.sha1.create()
      };
  
      c.session.sp = {
      entity: c.entity,
      prf_algorithm: tls.PRFAlgorithm.tls_prf_sha256,
      bulk_cipher_algorithm: tls.BulkCipherAlgorithm.aes,
      cipher_type: tls.CipherType.block,
      enc_key_length: keyLength,
      block_length: 16,
      fixed_iv_length: 16,
      record_iv_length: 16,
      mac_algorithm: tls.MACAlgorithm.hmac_sha1,
      mac_length: 20,
      mac_key_length: 20,
      compression_algorithm: c.session.compressionMethod,
      pre_master_secret: null,
      master_secret: null,
      client_random: cRandom,
      server_random: sRandom
      };
    */

  /*
  var dhprime=new BigInteger('FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE649286651ECE65381FFFFFFFFFFFFFFFF',16);
  var dhg=new BigInteger('02',16);
  var secretX=new BigInteger('04',16);
  alert(dhg.modPow(secretX,dhprime).toString(16));
  */

  /*{if(Y>0){Z.error(Z,{message:"Invalid key parameters. Only RSA is supported.",send:true,alert:{level:g.Alert.Level.fatal,description:g.Alert.Description.unsupported_certificate}})}else{Z.expect=L;Z.process()}}*/

  var DHE_handleServerKeyExchange = function (c, record, length) {
    // this implementation only supports RSA, no Diffie-Hellman support
    // so any length > 0 is invalid
    if (length > 0) {
      /*
select (KeyExchangeAlgorithm) {
     case dh_anon:
       ServerDHParams params;
     case dhe_dss:
     case dhe_rsa:
       ServerDHParams params;
       digitally-signed struct {
         opaque client_random[32];
         opaque server_random[32];
         ServerDHParams params;
       } signed_params;
     case rsa:
     case dh_dss:
     case dh_rsa:
       struct {} ;
      message is omitted for rsa, dh_dss, and dh_rsa
     may be extended, e.g., for ECDH -- see [TLSECC]
} ServerKeyExchange;
struct { Lenght 2 bytes + data
  opaque dh_p<1..2^16-1>;
  opaque dh_g<1..2^16-1>;
  opaque dh_Ys<1..2^16-1>;
} ServerDHParams;
dh_p
 The prime modulus used for the Diffie-Hellman operation.
 
dh_g
 The generator used for the Diffie-Hellman operation.
 
dh_Ys
The server's Diffie-Hellman public value (g^X mod p).
*/

      var b = record.fragment;
      var dhe = c.session.sp.DHE = {};
      dhe.prime = b.getBytes(b.getInt(16));
      //alert((new Buffer(prime,'binary')).toString('hex'));
      dhe.g = b.getBytes(b.getInt(16));
      dhe.server_public_key = b.getBytes(b.getInt(16));
      dhe.signature = b.getBytes(b.getInt(16));
      //TODO check signature

    }
    //else {
    // expect an optional CertificateRequest message next
    c.expect = L;

    // continue
    c.process();
    //}
  };

  /*g.createClientKeyExchange=function(ac){var X=N.util.createBuffer();X.putByte(g.Version.major);X.putByte(g.Version.minor);X.putBytes(N.random.getBytes(46));var aa=ac.session.sp;aa.pre_master_secret=X.getBytes();var Y=ac.session.serverCertificate.publicKey;X=Y.encrypt(aa.pre_master_secret);var Z=X.length+2;var ab=N.util.createBuffer();ab.putByte(g.HandshakeType.client_key_exchange);ab.putInt24(Z);ab.putInt16(X.length);ab.putBytes(X);return ab}*/

  var DHE_createClientKeyExchange = function (ac) {
    /*
    createSecurityParameters modified
    switch(ac.session.cipherSuite) {
      case g.CipherSuites.TLS_RSA_WITH_AES_128_CBC_SHA:
      keyLength = 16;
      break;
      case g.CipherSuites.TLS_RSA_WITH_AES_256_CBC_SHA:
      keyLength = 32;
      break;
      }
      struct {
        select (KeyExchangeAlgorithm) {
          case rsa:
            EncryptedPreMasterSecret;
          case dhe_dss:
          case dhe_rsa:
          case dh_dss:
          case dh_rsa:
          case dh_anon:
            ClientDiffieHellmanPublic;
        } exchange_keys;
      } ClientKeyExchange;

      struct {
        select (PublicValueEncoding) {
          case implicit: struct { };
          case explicit: opaque dh_Yc<1..2^16-1>;
        } dh_public;
      } ClientDiffieHellmanPublic;

      dh_Yc
       The client's Diffie-Hellman public value (Yc).

    */
    // create buffer to encrypt
    var aa = ac.session.sp;
    var X;
    if (!aa.DHE) {
      // add highest client-supported protocol to help server avoid version
      // rollback attacks
      X = N.util.createBuffer();

      X.putByte(g.Version.major);
      X.putByte(g.Version.minor);

      // generate and add 46 random bytes
      X.putBytes(N.random.getBytes(46));

      // save pre-master secret
      aa.pre_master_secret = X.getBytes();

      // RSA-encrypt the pre-master secret
      var Y = ac.session.serverCertificate.publicKey;
      X = Y.encrypt(aa.pre_master_secret);

      /* Note: The encrypted pre-master secret will be stored in a
      public-key-encrypted opaque vector that has the length prefixed using
      2 bytes, so include those 2 bytes in the handshake message length. This
      is done as a minor optimization instead of calling writeVector(). */
    } else {
      var dhe = aa.DHE;
      var client_key = new BigInteger(Rand(128).toString('hex'), 16);
      var prime = new BigInteger(new Buffer(dhe.prime, 'binary').toString('hex'), 16);
      var gdh = new BigInteger(new Buffer(dhe.g, 'binary').toString('hex'), 16);
      var server_key = new BigInteger(new Buffer(dhe.server_public_key, 'binary').toString('hex'), 16);
      var sec = new Buffer(server_key.modPow(client_key, prime).toString(16), 'hex');
      aa.pre_master_secret = sec.toString('binary');
      //console.log('Pre Master: '+sec.toString('hex'));
      if (!forge_buffers) {
        X = new Buffer(gdh.modPow(client_key, prime).toString(16), 'hex');
        //console.log('Client public key: '+X.toString('hex'));
      } else {
        X = (new Buffer(gdh.modPow(client_key, prime).toString(16), 'hex')).toString('binary');
      };
    };
    // determine length of the handshake message
    var Z = X.length + 2;

    // build record fragment
    var ab = N.util.createBuffer();
    ab.putByte(g.HandshakeType.client_key_exchange);
    ab.putInt24(Z);
    // add vector length bytes
    ab.putInt16(X.length);
    ab.putBytes(X);
    return ab;
  };
  g.getCipherSuite = function (X) {
    var aa = null;
    for (var Y in g.CipherSuites) {
      var Z = g.CipherSuites[Y];
      if (Z[0] === X.charCodeAt(0) && Z[1] === X.charCodeAt(1)) {
        aa = Z;
        break
      }
    }
    return aa
  };
  g.handleUnexpected = function (Z, X) {
    var Y = (!Z.open && Z.entity === g.ConnectionEnd.client); /* modif Ayms ignore unexpected */;
    console.log('unexpected message ----------------');
    Y = true;
    if (!Y) {
      Z.error(Z, {
        message: "Unexpected message. Received TLS record out of order.",
        send: true,
        alert: {
          level: g.Alert.Level.fatal,
          description: g.Alert.Description.unexpected_message
        }
      })
    }
  };
  g.handleHelloRequest = function (Z, X, Y) {
    if (!Z.handshaking && Z.handshakes > 0) {
      g.queue(Z, g.createAlert({
        level: g.Alert.Level.warning,
        description: g.Alert.Description.no_renegotiation
      }));
      g.flush(Z)
    }
    Z.process()
  };
  g.parseHelloMessage = function (ag, af, Z) {
    var aa = null;
    var ab = (ag.entity == g.ConnectionEnd.client);
    if (Z < 38) {
      ag.error(ag, {
        message: ab ? "Invalid ServerHello message. Message too short." : "Invalid ClientHello message. Message too short.",
        send: true,
        alert: {
          level: g.Alert.Level.fatal,
          description: g.Alert.Description.illegal_parameter
        }
      })
    } else {
      var ai = af.fragment;
      aa = {
        version: {
          major: ai.getByte(),
          minor: ai.getByte()
        },
        random: N.util.createBuffer(ai.getBytes(32)),
        session_id: d(ai, 1),
        extensions: []
      };
      if (ab) {
        aa.cipher_suite = ai.getBytes(2);
        aa.compression_method = ai.getByte()
      } else {
        aa.cipher_suites = d(ai, 2);
        aa.compression_methods = d(ai, 1)
      };
      if (ai.length() > 0) {
        var ac = d(ai, 2);
        while (ac.length() > 0) {
          aa.extensions.push({
            type: [ac.getByte(), ac.getByte()],
            data: d(ac, 2)
          })
        }
        if (!ab) {
          for (var ae = 0; ae < aa.extensions.length; ++ae) {
            var Y = aa.extensions[ae];
            if (Y.type[0] === 0 && Y.type[1] === 0) {
              var X = d(Y.data, 2);
              while (X.length() > 0) {
                var ah = X.getByte();
                if (ah !== 0) {
                  break
                }
                ag.session.serverNameList.push(d(X, 2).getBytes())
              }
            }
          }
        }
      }; /*if(aa.version.major!==g.Version.major||aa.version.minor!==g.Version.minor){ag.error(ag,{message:"Incompatible TLS version.",send:true,alert:{level:g.Alert.Level.fatal,description:g.Alert.Description.protocol_version}})}*/
      if (ab) {
        ag.session.cipherSuite = g.getCipherSuite(aa.cipher_suite)
      } else {
        var ad = N.util.createBuffer(aa.cipher_suites.bytes());
        while (ad.length() > 0) {
          ag.session.cipherSuite = g.getCipherSuite(ad.getBytes(2));
          if (ag.session.cipherSuite !== null) {
            break
          }
        }
      }
      if (ag.session.cipherSuite === null) {
        ag.error(ag, {
          message: "No cipher suites in common.",
          send: true,
          alert: {
            level: g.Alert.Level.fatal,
            description: g.Alert.Description.handshake_failure
          },
          cipherSuite: N.util.bytesToHex(aa.cipher_suite)
        })
      }
      if (ab) {
        ag.session.compressionMethod = aa.compression_method
      } else {
        ag.session.compressionMethod = g.CompressionMethod.none
      }
    };
    return aa
  };
  g.createSecurityParameters = function (ad, aa) {
    var Z;
    switch (ad.session.cipherSuite) {
      case g.CipherSuites.TLS_RSA_WITH_AES_128_CBC_SHA:
        Z = 16;
        break;
      case g.CipherSuites.TLS_DHE_RSA_WITH_AES_128_CBC_SHA:
        Z = 16;
        break;
      case g.CipherSuites.TLS_RSA_WITH_AES_256_CBC_SHA:
        Z = 32;
        break;
      case g.CipherSuites.TLS_DHE_RSA_WITH_AES_256_CBC_SHA:
        Z = 32;
        break
    }
    var X = (ad.entity === g.ConnectionEnd.client);
    var Y = aa.random.bytes();
    var ac = X ? ad.session.sp.client_random : Y;
    var ab = X ? Y : g.createRandom().getBytes();
    ad.session.sp = {
      entity: ad.entity,
      prf_algorithm: g.PRFAlgorithm.tls_prf_sha256,
      bulk_cipher_algorithm: g.BulkCipherAlgorithm.aes,
      cipher_type: g.CipherType.block,
      enc_key_length: Z,
      block_length: 16,
      fixed_iv_length: 16,
      record_iv_length: 16,
      mac_algorithm: g.MACAlgorithm.hmac_sha1,
      mac_length: 20,
      mac_key_length: 20,
      compression_algorithm: ad.session.compressionMethod,
      pre_master_secret: null,
      master_secret: null,
      client_random: ac,
      server_random: ab
    }
  };
  g.handleServerHello = function (ab, X, Y) {
    var aa = g.parseHelloMessage(ab, X, Y);
    if (!ab.fail) {
      var Z = aa.session_id.bytes(); /*modif*/
      if (Z && (Z === ab.session.id)) {
        ab.expect = T;
        ab.session.resuming = true;
        ab.session.sp.server_random = aa.random.bytes()
      } else {
        ab.expect = R;
        ab.session.resuming = false;
        g.createSecurityParameters(ab, aa)
      };
      ab.session.id = Z;
      ab.process()
    }
  };
  g.handleClientHello = function (ac, X, Y) {
    var ab = g.parseHelloMessage(ac, X, Y);
    if (!ac.fail) {
      var aa = ab.session_id.bytes();
      var Z = null;
      if (ac.sessionCache) {
        Z = ac.sessionCache.getSession(aa);
        if (Z === null) {
          aa = ""
        }
      }
      if (aa.length === 0) {
        aa = N.random.getBytes(32)
      }
      ac.session.id = aa;
      ac.session.clientHelloVersion = ab.version;
      ac.session.sp = Z ? Z.sp : {};
      if (Z !== null) {
        ac.expect = M;
        ac.session.resuming = true;
        ac.session.sp.client_random = ab.random.bytes()
      } else {
        ac.expect = (ac.verifyClient !== false) ? K : c;
        ac.session.resuming = false;
        g.createSecurityParameters(ac, ab)
      }
      ac.open = true;
      g.queue(ac, g.createRecord({
        type: g.ContentType.handshake,
        data: g.createServerHello(ac)
      }));
      if (ac.session.resuming) {
        g.queue(ac, g.createRecord({
          type: g.ContentType.change_cipher_spec,
          data: g.createChangeCipherSpec()
        }));
        ac.state.pending = g.createConnectionState(ac);
        ac.state.current.write = ac.state.pending.write;
        g.queue(ac, g.createRecord({
          type: g.ContentType.handshake,
          data: g.createFinished(ac)
        }))
      } else {
        g.queue(ac, g.createRecord({
          type: g.ContentType.handshake,
          data: g.createCertificate(ac)
        })); /*g.queue(ac,g.createRecord({type:g.ContentType.handshake,data:g.createServerKeyExchange(ac)}))*/;
        if (ac.verifyClient !== false) {
          g.queue(ac, g.createRecord({
            type: g.ContentType.handshake,
            data: g.createCertificateRequest(ac)
          }))
        }
        g.queue(ac, g.createRecord({
          type: g.ContentType.handshake,
          data: g.createServerHelloDone(ac)
        }))
      }
      g.flush(ac);
      ac.process()
    }
  };
  g.handleCertificate = function (af, ad, X) {
    if (X < 3) {
      af.error(af, {
        message: "Invalid Certificate message. Message too short.",
        send: true,
        alert: {
          level: g.Alert.Level.fatal,
          description: g.Alert.Description.illegal_parameter
        }
      })
    } else {
      var ag = ad.fragment;
      var Y = {
        certificate_list: d(ag, 3)
      };
      var ab, aa;
      var ac = [];
      try {
        while (Y.certificate_list.length() > 0) {
          ab = d(Y.certificate_list, 3);
          aa = N.asn1.fromDer(ab);
          ab = N.pki.certificateFromAsn1(aa, true);
          ac.push(ab)
        }
      } catch (ae) {
        console.error(af, {
          message: "Could not parse certificate list.",
          cause: ae,
          send: true,
          alert: {
            level: g.Alert.Level.fatal,
            description: g.Alert.Description.bad_certificate
          }
        })
      }
      if (!af.fail) {
        var Z = (af.entity === g.ConnectionEnd.client);
        if ((Z || af.verifyClient === true) && ac.length === 0) {
          console.error(af, {
            message: Z ? "No server certificate provided." : "No client certificate provided.",
            send: true,
            alert: {
              level: g.Alert.Level.fatal,
              description: g.Alert.Description.illegal_parameter
            }
          })
        } else {
          if (ac.length === 0) {
            af.expect = Z ? k : c
          } else {
            if (Z) {
              af.session.serverCertificate = ac[0]
            } else {
              af.session.clientCertificate = ac[0]
            }
            if (g.verifyCertificateChain(af, ac)) {
              af.expect = Z ? k : c
            }
          }
        }
        af.process()
      }
    }
  };
  g.handleServerKeyExchange = DHE_handleServerKeyExchange;
  g.handleClientKeyExchange = function (ae, aa, ac) {
    if (ac < 48) {
      ae.error(ae, {
        message: "Invalid key parameters. Only RSA is supported.",
        send: true,
        alert: {
          level: g.Alert.Level.fatal,
          description: g.Alert.Description.unsupported_certificate
        }
      })
    } else {
      var X = aa.fragment;
      msg = {
        enc_pre_master_secret: d(X, 2).getBytes()
      };
      var Z = null;
      if (ae.getPrivateKey) {
        try {
          Z = ae.getPrivateKey(ae, ae.session.serverCertificate);
          Z = N.pki.privateKeyFromPem(Z)
        } catch (ab) {
          ae.error(ae, {
            message: "Could not get private key.",
            cause: ab,
            send: true,
            alert: {
              level: g.Alert.Level.fatal,
              description: g.Alert.Description.internal_error
            }
          })
        }
      }
      if (Z === null) {
        ae.error(ae, {
          message: "No private key set.",
          send: true,
          alert: {
            level: g.Alert.Level.fatal,
            description: g.Alert.Description.internal_error
          }
        })
      } else {
        try {
          var ad = ae.session.sp;
          ad.pre_master_secret = Z.decrypt(msg.enc_pre_master_secret);
          var Y = ae.session.clientHelloVersion;
          if (Y.major !== ad.pre_master_secret.charCodeAt(0) || Y.minor !== ad.pre_master_secret.charCodeAt(1)) {
            throw {
              message: "TLS version rollback attack detected."
            }
          }
        } catch (ab) {
          ad.pre_master_secret = N.random.getBytes(48)
        }
      }
    }
    if (!ae.fail) {
      ae.expect = M;
      if (ae.session.clientCertificate !== null) {
        ae.expect = x
      }
      ae.process()
    }
  };
  g.handleCertificateRequest = function (ab, Y, Z) {
    if (Z < 3) {
      ab.error(ab, {
        message: "Invalid CertificateRequest. Message too short.",
        send: true,
        alert: {
          level: g.Alert.Level.fatal,
          description: g.Alert.Description.illegal_parameter
        }
      })
    } else {
      var X = Y.fragment;
      var aa = {
        certificate_types: d(X, 1),
        certificate_authorities: d(X, 2)
      };
      ab.session.certificateRequest = aa;
      ab.expect = i;
      ab.process()
    }
  };
  g.handleCertificateVerify = function (ae, Y, ac) {
    if (ac < 2) {
      ae.error(ae, {
        message: "Invalid CertificateVerify. Message too short.",
        send: true,
        alert: {
          level: g.Alert.Level.fatal,
          description: g.Alert.Description.illegal_parameter
        }
      })
    } else {
      var X = Y.fragment;
      X.read -= 4;
      var Z = X.bytes();
      X.read += 4;
      msg = {
        signature: d(X, 2).getBytes()
      };
      var ad = N.util.createBuffer();
      ad.putBuffer(ae.session.md5.digest());
      ad.putBuffer(ae.session.sha1.digest());
      ad = ad.getBytes();
      try {
        var ab = ae.session.clientCertificate;
        X = N.pki.rsa.decrypt(msg.signature, ab.publicKey, true, ad.length);
        if (X !== ad) {
          throw {
            message: "CertificateVerify signature does not match."
          }
        }
        ae.session.md5.update(Z);
        ae.session.sha1.update(Z)
      } catch (aa) {
        ae.error(ae, {
          message: "Bad signature in CertificateVerify.",
          send: true,
          alert: {
            level: g.Alert.Level.fatal,
            description: g.Alert.Description.handshake_failure
          }
        })
      }
      if (!ae.fail) {
        ae.expect = M;
        ae.process()
      }
    }
  };
  g.handleServerHelloDone = function (ac, X, aa) {
    if (aa > 0) {
      ac.error(ac, {
        message: "Invalid ServerHelloDone message. Invalid length.",
        send: true,
        alert: {
          level: g.Alert.Level.fatal,
          description: g.Alert.Description.record_overflow
        }
      })
    } else {
      if (ac.serverCertificate === null) {
        var Z = {
          message: "No server certificate provided. Not enough security.",
          send: true,
          alert: {
            level: g.Alert.Level.fatal,
            description: g.Alert.Description.insufficient_security
          }
        };
        var Y = ac.verify(ac, Z.alert.description, depth, []);
        if (Y === true) {
          Z = null
        } else {
          if (Y || Y === 0) {
            if (Y.constructor == Object) {
              if (Y.message) {
                Z.message = Y.message
              }
              if (Y.alert) {
                Z.alert.description = Y.alert
              }
            } else {
              if (Y.constructor == Number) {
                Z.alert.description = Y
              }
            }
          }
          ac.error(ac, Z)
        }
      }
    }
    if (!ac.fail && ac.session.certificateRequest !== null) {
      X = g.createRecord({
        type: g.ContentType.handshake,
        data: g.createCertificate(ac)
      });
      g.queue(ac, X)
    }
    if (!ac.fail) {
      X = g.createRecord({
        type: g.ContentType.handshake,
        data: g.createClientKeyExchange(ac)
      });
      g.queue(ac, X);
      ac.expect = a;
      var ab = function (ae, ad) {
        if (ae.session.certificateRequest !== null && ae.session.clientCertificate !== null) {
          g.queue(ae, g.createRecord({
            type: g.ContentType.handshake,
            data: g.createCertificateVerify(ae, ad)
          }))
        }
        g.queue(ae, g.createRecord({
          type: g.ContentType.change_cipher_spec,
          data: g.createChangeCipherSpec()
        }));
        ae.state.pending = g.createConnectionState(ae);
        ae.state.current.write = ae.state.pending.write;
        g.queue(ae, g.createRecord({
          type: g.ContentType.handshake,
          data: g.createFinished(ae)
        }));
        ae.expect = T;
        g.flush(ae);
        ae.process()
      };
      if (ac.session.certificateRequest === null || ac.session.clientCertificate === null) {
        ab(ac, null)
      } else {
        g.getClientSignature(ac, ab)
      }
    }
  };
  g.handleChangeCipherSpec = function (Z, Y) {
    if (Y.fragment.getByte() != 1) {
      Z.error(Z, {
        message: "Invalid ChangeCipherSpec message received.",
        send: true,
        alert: {
          level: g.Alert.Level.fatal,
          description: g.Alert.Description.illegal_parameter
        }
      })
    } else {
      var X = (Z.entity === g.ConnectionEnd.client);
      if ((Z.session.resuming && X) || (!Z.session.resuming && !X)) {
        Z.state.pending = g.createConnectionState(Z)
      }
      Z.state.current.read = Z.state.pending.read;
      if ((!Z.session.resuming && X) || (Z.session.resuming && !X)) {
        Z.state.pending = null
      }
      Z.expect = X ? P : G;
      Z.process()
    }
  };
  g.handleFinished = function (af, ad, Z) {
    var ag = ad.fragment;
    ag.read -= 4;
    var aa = ag.bytes();
    ag.read += 4;
    var ae = ad.fragment.getBytes();
    ag = N.util.createBuffer();
    ag.putBuffer(af.session.md5.digest());
    ag.putBuffer(af.session.sha1.digest());
    var ac = (af.entity === g.ConnectionEnd.client);
    var ah = ac ? "server finished" : "client finished";
    var X = af.session.sp;
    var Y = 12;
    var ab = O;
    ag = ab(X.master_secret, ah, ag.getBytes(), Y);
    if (ag.getBytes() !== ae) {
      af.error(af, {
        message: "Invalid verify_data in Finished message.",
        send: true,
        alert: {
          level: g.Alert.Level.fatal,
          description: g.Alert.Description.decrypt_error
        }
      })
    } else {
      af.session.md5.update(aa);
      af.session.sha1.update(aa);
      if ((af.session.resuming && ac) || (!af.session.resuming && !ac)) {
        g.queue(af, g.createRecord({
          type: g.ContentType.change_cipher_spec,
          data: g.createChangeCipherSpec()
        }));
        af.state.current.write = af.state.pending.write;
        af.state.pending = null;
        g.queue(af, g.createRecord({
          type: g.ContentType.handshake,
          data: g.createFinished(af)
        }))
      }
      af.expect = ac ? v : q;
      af.handshaking = false;
      ++af.handshakes;
      af.peerCertificate = ac ? af.session.serverCertificate : af.session.clientCertificate;
      if (af.sessionCache) {
        af.session = {
          id: af.session.id,
          sp: af.session.sp
        };
        af.session.sp.keys = null
      } else {
        af.session = null
      }
      g.flush(af);
      af.isConnected = true;
      af.connected(af);
      af.process()
    }
  };
  g.handleAlert = function (ab, Y) {
    var X = Y.fragment;
    var aa = {
      level: X.getByte(),
      description: X.getByte()
    };
    var Z;
    switch (aa.description) {
      case g.Alert.Description.close_notify:
        Z = "Connection closed.";
        break;
      case g.Alert.Description.unexpected_message:
        Z = "Unexpected message.";
        break;
      case g.Alert.Description.bad_record_mac:
        Z = "Bad record MAC.";
        break;
      case g.Alert.Description.decryption_failed:
        Z = "Decryption failed.";
        break;
      case g.Alert.Description.record_overflow:
        Z = "Record overflow.";
        break;
      case g.Alert.Description.decompression_failure:
        Z = "Decompression failed.";
        break;
      case g.Alert.Description.handshake_failure:
        Z = "Handshake failure.";
        break;
      case g.Alert.Description.bad_certificate:
        Z = "Bad certificate.";
        break;
      case g.Alert.Description.unsupported_certificate:
        Z = "Unsupported certificate.";
        break;
      case g.Alert.Description.certificate_revoked:
        Z = "Certificate revoked.";
        break;
      case g.Alert.Description.certificate_expired:
        Z = "Certificate expired.";
        break;
      case g.Alert.Description.certificate_unknown:
        Z = "Certificate unknown.";
        break;
      case g.Alert.Description.illegal_parameter:
        Z = "Illegal parameter.";
        break;
      case g.Alert.Description.unknown_ca:
        Z = "Unknown certificate authority.";
        break;
      case g.Alert.Description.access_denied:
        Z = "Access denied.";
        break;
      case g.Alert.Description.decode_error:
        Z = "Decode error.";
        break;
      case g.Alert.Description.decrypt_error:
        Z = "Decrypt error.";
        break;
      case g.Alert.Description.export_restriction:
        Z = "Export restriction.";
        break;
      case g.Alert.Description.protocol_version:
        Z = "Unsupported protocol version.";
        break;
      case g.Alert.Description.insufficient_security:
        Z = "Insufficient security.";
        break;
      case g.Alert.Description.internal_error:
        Z = "Internal error.";
        break;
      case g.Alert.Description.user_canceled:
        Z = "User canceled.";
        break;
      case g.Alert.Description.no_renegotiation:
        Z = "Renegotiation not supported.";
        break;
      default:
        Z = "Unknown error.";
        break
    }
    if (aa.description === g.Alert.Description.close_notify) {
      ab.close()
    } else {
      ab.error(ab, {
        message: Z,
        send: false,
        origin: (ab.entity === g.ConnectionEnd.client) ? "server" : "client",
        alert: aa
      });
      ab.process()
    }
  };
  g.handleHandshake = function (ac, Z) {
    var X = Z.fragment;
    var aa = X.getByte();
    var ab = X.getInt24();
    if (ab > X.length()) {
      ac.fragmented = Z;
      Z.fragment = N.util.createBuffer();
      X.read -= 4;
      ac.process()
    } else {
      ac.fragmented = null;
      X.read -= 4;
      var Y = X.bytes(ab + 4);
      X.read += 4;
      if (aa in Q[ac.entity][ac.expect]) {
        if (ac.entity === g.ConnectionEnd.server && !ac.open && !ac.fail) {
          ac.handshaking = true;
          ac.session = {
            serverNameList: [],
            cipherSuite: null,
            compressionMethod: null,
            serverCertificate: null,
            clientCertificate: null,
            md5: N.md.md5.create(),
            sha1: N.md.sha1.create()
          }
        }
        if (aa !== g.HandshakeType.hello_request && aa !== g.HandshakeType.certificate_verify && aa !== g.HandshakeType.finished) {
          ac.session.md5.update(Y);
          ac.session.sha1.update(Y)
        }
        Q[ac.entity][ac.expect][aa](ac, Z, ab)
      } else {
        g.handleUnexpected(ac, Z)
      }
    }
  };
  g.handleApplicationData = function (Y, X) {
    Y.data.putBuffer(X.fragment);
    Y.dataReady(Y);
    Y.process()
  };
  var h = 0;
  var R = 1;
  var k = 2;
  var L = 3;
  var i = 4;
  var T = 5;
  var P = 6;
  var v = 7;
  var a = 8;
  var b = 0;
  var K = 1;
  var c = 2;
  var x = 3;
  var M = 4;
  var G = 5;
  var q = 6;
  var U = 7;
  var W = g.handleUnexpected;
  var J = g.handleChangeCipherSpec;
  var H = g.handleAlert;
  var F = g.handleHandshake;
  var E = g.handleApplicationData;
  var o = [];
  o[g.ConnectionEnd.client] = [
    [W, W, F, W],
    [W, H, F, W],
    [W, H, F, W],
    [W, H, F, W],
    [W, H, F, W],
    [J, H, W, W],
    [W, H, F, W],
    [W, H, F, E],
    [W, H, F, W]
  ];
  o[g.ConnectionEnd.server] = [
    [W, W, F, W],
    [W, H, F, W],
    [W, H, F, W],
    [W, H, F, W],
    [J, H, W, W],
    [W, H, F, W],
    [W, H, F, E],
    [W, H, F, W]
  ];
  var D = g.handleHelloRequest;
  var C = g.handleServerHello;
  var B = g.handleCertificate;
  var A = g.handleServerKeyExchange;
  var z = g.handleCertificateRequest;
  var y = g.handleServerHelloDone;
  var w = g.handleFinished;
  var Q = [];
  Q[g.ConnectionEnd.client] = [
    [W, W, C, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
    [D, W, W, W, W, W, W, W, W, W, W, B, A, z, y, W, W, W, W, W, W],
    [D, W, W, W, W, W, W, W, W, W, W, W, A, z, y, W, W, W, W, W, W],
    [D, W, W, W, W, W, W, W, W, W, W, W, W, z, y, W, W, W, W, W, W],
    [D, W, W, W, W, W, W, W, W, W, W, W, W, W, y, W, W, W, W, W, W],
    [D, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
    [D, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, w],
    [D, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
    [D, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W]
  ];
  var u = g.handleClientHello;
  var t = g.handleClientKeyExchange;
  var s = g.handleCertificateVerify;
  Q[g.ConnectionEnd.server] = [
    [W, u, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
    [W, W, W, W, W, W, W, W, W, W, W, B, W, W, W, W, W, W, W, W, W],
    [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, t, W, W, W, W],
    [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, s, W, W, W, W, W],
    [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
    [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, w],
    [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
    [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W]
  ];
  g.generateKeys = function (ac, ab) {
    var aa = O;
    var Z = ab.client_random + ab.server_random;
    if (!ac.session.resuming) {
      ab.master_secret = aa(ab.pre_master_secret, "master secret", Z, 48).bytes();
      ab.pre_master_secret = null
    }
    Z = ab.server_random + ab.client_random;
    var Y = 2 * ab.mac_key_length + 2 * ab.enc_key_length + 2 * ab.fixed_iv_length;
    var X = aa(ab.master_secret, "key expansion", Z, Y);
    return {
      client_write_MAC_key: X.getBytes(ab.mac_key_length),
      server_write_MAC_key: X.getBytes(ab.mac_key_length),
      client_write_key: X.getBytes(ab.enc_key_length),
      server_write_key: X.getBytes(ab.enc_key_length),
      client_write_IV: X.getBytes(ab.fixed_iv_length),
      server_write_IV: X.getBytes(ab.fixed_iv_length)
    }
  };
  g.createConnectionState = function (ab) {
    var Y = (ab.entity === g.ConnectionEnd.client);
    var X = function () {
      var ac = {
        sequenceNumber: [0, 0],
        macKey: null,
        macLength: 0,
        macFunction: null,
        cipherState: null,
        cipherFunction: function (ad) {
          return true
        },
        compressionState: null,
        compressFunction: function (ad) {
          return true
        },
        updateSequenceNumber: function () {
          if (ac.sequenceNumber[1] == 4294967295) {
            ac.sequenceNumber[1] = 0;
            ++ac.sequenceNumber[0]
          } else {
            ++ac.sequenceNumber[1]
          }
        }
      };
      return ac
    };
    var aa = {
      read: X(),
      write: X()
    };
    aa.read.update = function (ad, ac) {
      if (!aa.read.cipherFunction(ac, aa.read)) {
        ad.error(ad, {
          message: "Could not decrypt record or bad MAC.",
          send: true,
          alert: {
            level: g.Alert.Level.fatal,
            description: g.Alert.Description.bad_record_mac
          }
        })
      } else {
        if (!aa.read.compressFunction(ad, ac, aa.read)) {
          ad.error(ad, {
            message: "Could not decompress record.",
            send: true,
            alert: {
              level: g.Alert.Level.fatal,
              description: g.Alert.Description.decompression_failure
            }
          })
        }
      }
      return !ad.fail
    };
    aa.write.update = function (ad, ac) {
      if (!aa.write.compressFunction(ad, ac, aa.write)) {
        ad.error(ad, {
          message: "Could not compress record.",
          send: false,
          alert: {
            level: g.Alert.Level.fatal,
            description: g.Alert.Description.internal_error
          }
        })
      } else {
        if (!aa.write.cipherFunction(ac, aa.write)) {
          ad.error(ad, {
            message: "Could not encrypt record.",
            send: false,
            alert: {
              level: g.Alert.Level.fatal,
              description: g.Alert.Description.internal_error
            }
          })
        }
      }
      return !ad.fail
    };
    if (ab.session) {
      var Z = ab.session.sp;
      Z.keys = g.generateKeys(ab, Z);
      aa.read.macKey = Y ? Z.keys.server_write_MAC_key : Z.keys.client_write_MAC_key;
      aa.write.macKey = Y ? Z.keys.client_write_MAC_key : Z.keys.server_write_MAC_key;
      aa.read.macLength = aa.write.macLength = Z.mac_length;
      switch (Z.mac_algorithm) {
        case g.MACAlgorithm.hmac_sha1:
          aa.read.macFunction = aa.write.macFunction = j;
          break;
        default:
          throw {
            message: "Unsupported MAC algorithm."
          }
      }
      switch (Z.bulk_cipher_algorithm) {
        case g.BulkCipherAlgorithm.aes:
          aa.read.cipherState = {
            init: false,
            cipher: N.aes.createDecryptionCipher(Y ? Z.keys.server_write_key : Z.keys.client_write_key),
            iv: Y ? Z.keys.server_write_IV : Z.keys.client_write_IV
          };
          aa.write.cipherState = {
            init: false,
            cipher: N.aes.createEncryptionCipher(Y ? Z.keys.client_write_key : Z.keys.server_write_key),
            iv: Y ? Z.keys.client_write_IV : Z.keys.server_write_IV
          };
          aa.read.cipherFunction = S;
          aa.write.cipherFunction = f;
          break;
        default:
          throw {
            message: "Unsupported cipher algorithm."
          }
      }
      switch (Z.cipher_type) {
        case g.CipherType.block:
          break;
        default:
          throw {
            message: "Unsupported cipher type."
          }
      }
      switch (Z.compression_algorithm) {
        case g.CompressionMethod.none:
          break;
        case g.CompressionMethod.deflate:
          aa.read.compressFunction = p;
          aa.write.compressFunction = I;
          break;
        default:
          throw {
            message: "Unsupported compression algorithm."
          }
      }
    }
    return aa
  };
  g.createRandom = function () {
    var Z = new Date();
    var X = +Z + Z.getTimezoneOffset() * 60000;
    var Y = N.util.createBuffer();
    Y.putInt32(X);
    Y.putBytes(N.random.getBytes(28));
    return Y
  };
  g.createRecord = function (Y) {
    var X = {
      type: Y.type,
      version: {
        major: g.Version.major,
        minor: g.Version.minor
      },
      length: Y.data.length(),
      fragment: Y.data
    };
    return X
  };
  g.createAlert = function (Y) {
    var X = N.util.createBuffer();
    X.putByte(Y.level);
    X.putByte(Y.description);
    return g.createRecord({
      type: g.ContentType.alert,
      data: X
    })
  };
  g.createClientHello = function (ah) {
    var ak = N.util.createBuffer();
    for (var ad = 0; ad < ah.cipherSuites.length; ++ad) {
      var af = ah.cipherSuites[ad];
      ak.putByte(af[0]);
      ak.putByte(af[1])
    }
    var aj = ak.length();
    var al = N.util.createBuffer();
    al.putByte(g.CompressionMethod.none);
    var Y = al.length();
    var ai = N.util.createBuffer();
    if (ah.virtualHost) {
      var aa = N.util.createBuffer();
      aa.putByte(0);
      aa.putByte(0);
      var X = N.util.createBuffer();
      X.putByte(0);
      n(X, 2, N.util.createBuffer(ah.virtualHost));
      var ag = N.util.createBuffer();
      n(ag, 2, X);
      n(aa, 2, ag);
      ai.putBuffer(aa)
    }
    var ac = ai.length();
    if (ac > 0) {
      ac += 2
    }
    var ab = ah.session.id;
    var Z = ab.length + 1 + 2 + 4 + 28 + 2 + aj + 1 + Y + ac;
    var ae = N.util.createBuffer();
    ae.putByte(g.HandshakeType.client_hello);
    ae.putInt24(Z);
    ae.putByte(g.Version.major);
    ae.putByte(g.Version.minor);
    ae.putBytes(ah.session.sp.client_random);
    n(ae, 1, N.util.createBuffer(ab));
    n(ae, 2, ak);
    n(ae, 1, al);
    if (ac > 0) {
      n(ae, 2, ai)
    }
    return ae
  };
  g.createServerHello = function (aa) {
    var Z = aa.session.id;
    var X = Z.length + 1 + 2 + 4 + 28 + 2 + 1;
    var Y = N.util.createBuffer();
    Y.putByte(g.HandshakeType.server_hello);
    Y.putInt24(X);
    Y.putByte(g.Version.major);
    Y.putByte(g.Version.minor);
    Y.putBytes(aa.session.sp.server_random);
    n(Y, 1, N.util.createBuffer(Z));
    Y.putByte(aa.session.cipherSuite[0]);
    Y.putByte(aa.session.cipherSuite[1]);
    Y.putByte(aa.session.compressionMethod);
    return Y
  };
  g.createCertificate = function (ag) {
    var Y = (ag.entity === g.ConnectionEnd.client);
    var ab = null;
    if (ag.getCertificate) {
      ab = ag.getCertificate(ag, Y ? ag.session.certificateRequest : ag.session.serverNameList)
    }
    var ah = N.util.createBuffer();
    if (ab !== null) {
      try {
        if ((Array.isArray && !Array.isArray(ab)) || ab.constructor !== Array) {
          ab = [ab]
        }
        var Z = null;
        for (var ac = 0; ac < ab.length; ++ac) {
          var af = N.pki.pemToDer(ab);
          if (Z === null) {
            Z = N.asn1.fromDer(af.bytes())
          }
          var aa = N.util.createBuffer();
          n(aa, 3, af);
          ah.putBuffer(aa)
        }
        ab = N.pki.certificateFromAsn1(Z);
        if (Y) {
          ag.session.clientCertificate = ab
        } else {
          ag.session.serverCertificate = ab
        }
      } catch (ae) {
        ag.error(ag, {
          message: "Could not send certificate list.",
          cause: ae,
          send: true,
          alert: {
            level: g.Alert.Level.fatal,
            description: g.Alert.Description.bad_certificate
          }
        })
      }
    }
    var X = 3 + ah.length();
    var ad = N.util.createBuffer();
    ad.putByte(g.HandshakeType.certificate);
    ad.putInt24(X);
    n(ad, 3, ah);
    return ad
  };
  g.createClientKeyExchange = DHE_createClientKeyExchange;
  g.createServerKeyExchange = function (Z) {
    var X = 0;
    var Y = N.util.createBuffer(); /*Y.putByte(g.HandshakeType.server_key_exchange);Y.putInt24(X);*/
    return Y
  };
  g.getClientSignature = function (Z, Y) {
    var X = N.util.createBuffer();
    X.putBuffer(Z.session.md5.digest());
    X.putBuffer(Z.session.sha1.digest());
    X = X.getBytes();
    Z.getSignature = Z.getSignature || function (ae, aa, ad) {
      var ab = null;
      if (ae.getPrivateKey) {
        try {
          ab = ae.getPrivateKey(ae, ae.session.clientCertificate);
          ab = N.pki.privateKeyFromPem(ab)
        } catch (ac) {
          ae.error(ae, {
            message: "Could not get private key.",
            cause: ac,
            send: true,
            alert: {
              level: g.Alert.Level.fatal,
              description: g.Alert.Description.internal_error
            }
          })
        }
      }
      if (ab === null) {
        ae.error(ae, {
          message: "No private key set.",
          send: true,
          alert: {
            level: g.Alert.Level.fatal,
            description: g.Alert.Description.internal_error
          }
        })
      } else {
        aa = N.pki.rsa.encrypt(aa, ab, 1)
      }
      ad(ae, aa)
    };
    Z.getSignature(Z, X, Y)
  };
  g.createCertificateVerify = function (aa, X) {
    var Y = X.length + 2;
    var Z = N.util.createBuffer();
    Z.putByte(g.HandshakeType.certificate_verify);
    Z.putInt24(Y);
    Z.putInt16(X.length);
    Z.putBytes(X);
    return Z
  };
  g.createCertificateRequest = function (ae) {
    var Z = N.util.createBuffer();
    Z.putByte(1);
    var Y = N.util.createBuffer();
    for (var ab in ae.caStore.certs) {
      var aa = ae.caStore.certs[ab];
      var X = N.pki.distinguishedNameToAsn1(aa.subject);
      Y.putBuffer(N.asn1.toDer(X))
    }
    var ac = 1 + Z.length() + 2 + Y.length();
    var ad = N.util.createBuffer();
    ad.putByte(g.HandshakeType.certificate_request);
    ad.putInt24(ac);
    n(ad, 1, Z);
    n(ad, 2, Y);
    return ad
  };
  g.createServerHelloDone = function (Y) {
    var X = N.util.createBuffer();
    X.putByte(g.HandshakeType.server_hello_done);
    X.putInt24(0);
    return X
  };
  g.createChangeCipherSpec = function () {
    var X = N.util.createBuffer();
    X.putByte(1);
    return X
  };
  g.createFinished = function (ae) {
    var X = N.util.createBuffer();
    X.putBuffer(ae.session.md5.digest());
    X.putBuffer(ae.session.sha1.digest());
    var Y = (ae.entity === g.ConnectionEnd.client);
    var ac = ae.session.sp;
    var aa = 12;
    var ab = O;
    var Z = Y ? "client finished" : "server finished";
    X = ab(ac.master_secret, Z, X.getBytes(), aa);
    var ad = N.util.createBuffer();
    ad.putByte(g.HandshakeType.finished);
    ad.putInt24(X.length());
    ad.putBuffer(X);
    return ad
  };
  g.queue = function (ae, Y) {
    if (Y.type === g.ContentType.handshake) {
      var X = Y.fragment.bytes();
      ae.session.md5.update(X);
      ae.session.sha1.update(X);
      X = null
    }
    var Z;
    if (Y.fragment.length() <= g.MaxFragment) {
      Z = [Y]
    } else {
      Z = [];
      var ac = Y.fragment.bytes();
      while (ac.length > g.MaxFragment) {
        Z.push(g.createRecord({
          type: Y.type,
          data: N.util.createBuffer(ac.slice(0, g.MaxFragment))
        }));
        ac = ac.slice(g.MaxFragment)
      }
      if (ac.length > 0) {
        Z.push(g.createRecord({
          type: Y.type,
          data: N.util.createBuffer(ac)
        }))
      }
    }
    for (var aa = 0; aa < Z.length && !ae.fail; ++aa) {
      var ad = Z[aa];
      var ab = ae.state.current.write;
      if (ab.update(ae, ad)) {
        ae.records.push(ad)
      }
    }
  };
  g.flush = function (Z) {
    for (var Y = 0; Y < Z.records.length; ++Y) {
      var X = Z.records[Y];
      Z.tlsData.putByte(X.type);
      Z.tlsData.putByte(X.version.major);
      Z.tlsData.putByte(X.version.minor);
      Z.tlsData.putInt16(X.fragment.length());
      Z.tlsData.putBuffer(Z.records[Y].fragment)
    }
    Z.records = [];
    return Z.tlsDataReady(Z)
  };
  var m = function (X) {
    switch (X) {
      case true:
        return true;
      case N.pki.certificateError.bad_certificate:
        return g.Alert.Description.bad_certificate;
      case N.pki.certificateError.unsupported_certificate:
        return g.Alert.Description.unsupported_certificate;
      case N.pki.certificateError.certificate_revoked:
        return g.Alert.Description.certificate_revoked;
      case N.pki.certificateError.certificate_expired:
        return g.Alert.Description.certificate_expired;
      case N.pki.certificateError.certificate_unknown:
        return g.Alert.Description.certificate_unknown;
      case N.pki.certificateError.unknown_ca:
        return g.Alert.Description.unknown_ca;
      default:
        return g.Alert.Description.bad_certificate
    }
  };
  var l = function (X) {
    switch (X) {
      case true:
        return true;
      case g.Alert.Description.bad_certificate:
        return N.pki.certificateError.bad_certificate;
      case g.Alert.Description.unsupported_certificate:
        return N.pki.certificateError.unsupported_certificate;
      case g.Alert.Description.certificate_revoked:
        return N.pki.certificateError.certificate_revoked;
      case g.Alert.Description.certificate_expired:
        return N.pki.certificateError.certificate_expired;
      case g.Alert.Description.certificate_unknown:
        return N.pki.certificateError.certificate_unknown;
      case g.Alert.Description.unknown_ca:
        return N.pki.certificateError.unknown_ca;
      default:
        return N.pki.certificateError.bad_certificate
    }
  };
  g.verifyCertificateChain = function (aa, Y) {
    try {
      N.pki.verifyCertificateChain(aa.caStore, Y, function Z(ae, ag, ad) {
        var af = m(ae);
        var ac = aa.verify(aa, ae, ag, ad);
        if (ac !== true) {
          if (ac.constructor === Object) {
            var ab = {
              message: "The application rejected the certificate.",
              send: true,
              alert: {
                level: g.Alert.Level.fatal,
                description: g.Alert.Description.bad_certificate
              }
            };
            if (ac.message) {
              ab.message = ac.message
            }
            if (ac.alert) {
              ab.alert.description = ac.alert
            }
            throw ab
          }
          if (ac !== ae) {
            ac = l(ac)
          }
        }
        return ac
      })
    } catch (X) {
      if (X.constructor !== Object) {
        X = {
          send: true,
          alert: {
            level: g.Alert.Level.fatal,
            description: m(X)
          }
        }
      }
      if (!("send" in X)) {
        X.send = true
      }
      if (!("alert" in X)) {
        X.alert = {
          level: g.Alert.Level.fatal,
          description: m(X.error)
        }
      }
      aa.error(aa, X)
    }
    return !aa.fail
  };
  g.createSessionCache = function (Y, X) {
    var aa = null;
    if (Y && Y.getSession && Y.setSession && Y.order) {
      aa = Y
    } else {
      aa = {};
      aa.cache = Y || {};
      aa.capacity = Math.max(X || 100, 1);
      aa.order = [];
      for (var Z in Y) {
        if (aa.order.length <= X) {
          aa.order.push(Z)
        } else {
          delete Y[Z]
        }
      }
      aa.getSession = function (ae) {
        var ad = null;
        var ac = null;
        if (ae) {
          ac = N.util.bytesToHex(ae)
        } else {
          if (aa.order.length > 0) {
            ac = aa.order[0]
          }
        }
        if (ac !== null && ac in aa.cache) {
          ad = aa.cache[ac];
          delete aa.cache[ac];
          for (var ab in aa.order) {
            if (aa.order[ab] === ac) {
              aa.order.splice(ab, 1);
              break
            }
          }
        }
        return ad
      };
      aa.setSession = function (ad, ac) {
        if (aa.order.length === aa.capacity) {
          var ab = aa.order.shift();
          delete aa.cache[ab]
        }
        var ab = N.util.bytesToHex(ad);
        aa.order.push(ab);
        aa.cache[ab] = ac
      }
    }
    return aa
  };
  g.createConnection = function (af) {
    var X = null;
    if (af.caStore) {
      if ((Array.isArray && Array.isArray(af.caStore)) || af.caStore.constructor == Array) {
        X = N.pki.createCaStore(af.caStore)
      } else {
        X = af.caStore
      }
    } else {
      X = N.pki.createCaStore()
    }
    var ad = af.cipherSuites || null;
    if (ad === null) {
      ad = [];
      ad.push(g.CipherSuites.TLS_RSA_WITH_AES_128_CBC_SHA);
      ad.push(g.CipherSuites.TLS_RSA_WITH_AES_256_CBC_SHA)
    }
    var aa = (af.server || false) ? g.ConnectionEnd.server : g.ConnectionEnd.client;
    var Z = af.sessionCache ? g.createSessionCache(af.sessionCache) : null;
    var ab = {
      entity: aa,
      sessionId: af.sessionId,
      caStore: X,
      sessionCache: Z,
      cipherSuites: ad,
      connected: af.connected,
      virtualHost: af.virtualHost || null,
      verifyClient: af.verifyClient || false,
      verify: af.verify || function (aj, ag, ai, ah) {
        return ag
      },
      getCertificate: af.getCertificate || null,
      getPrivateKey: af.getPrivateKey || null,
      getSignature: af.getSignature || null,
      input: N.util.createBuffer(),
      tlsData: N.util.createBuffer(),
      data: N.util.createBuffer(),
      tlsDataReady: af.tlsDataReady,
      dataReady: af.dataReady,
      closed: af.closed,
      error: function (ai, ag) {
        ag.origin = ag.origin || ((ai.entity === g.ConnectionEnd.client) ? "client" : "server");
        if (ag.send) {
          g.queue(ai, g.createAlert(ag.alert));
          g.flush(ai)
        }
        var ah = (ag.fatal !== false);
        if (ah) {
          ai.fail = true
        }
        af.error(ai, ag);
        if (ah) {
          ai.close(false)
        }
      },
      deflate: af.deflate || null,
      inflate: af.inflate || null
    };
    ab.reset = function (ag) {
      ab.record = null;
      ab.session = null;
      ab.peerCertificate = null;
      ab.state = {
        pending: null,
        current: null
      };
      ab.expect = (ab.entity === g.ConnectionEnd.client) ? h : b;
      ab.fragmented = null;
      ab.records = [];
      ab.open = false;
      ab.handshakes = 0;
      ab.handshaking = false;
      ab.isConnected = false;
      ab.fail = !(ag || typeof (ag) === "undefined");
      ab.input.clear();
      ab.tlsData.clear();
      ab.data.clear();
      ab.state.current = g.createConnectionState(ab)
    };
    ab.reset();
    var ae = function (aj, ag) {
      var ai = ag.type - g.ContentType.change_cipher_spec;
      var ah = o[aj.entity][aj.expect];
      if (ai in ah) {
        ah[ai](aj, ag)
      } else {
        g.handleUnexpected(aj, ag)
      }
    };
    var ac = function (aj) {
      var ai = 0;
      var ah = aj.input;
      var ag = ah.length();
      if (ag < 5) {
        ai = 5 - ag
      } else {
        aj.record = {
          type: ah.getByte(),
          version: {
            major: ah.getByte(),
            minor: ah.getByte()
          },
          length: ah.getInt16(),
          fragment: N.util.createBuffer(),
          ready: false
        }; /*if(aj.record.version.major!=g.Version.major||aj.record.version.minor!=g.Version.minor){aj.error(aj,{message:"Incompatible TLS version.",send:true,alert:{level:g.Alert.Level.fatal,description:g.Alert.Description.protocol_version}})}*/
      }
      return ai
    };
    var Y = function (ak) {
      var aj = 0;
      var ah = ak.input;
      var ag = ah.length();
      if (ag < ak.record.length) {
        aj = ak.record.length - ag
      } else {
        ak.record.fragment.putBytes(ah.getBytes(ak.record.length)); /*modif Ayms*/
        ah.compact();
        var ai = ak.state.current.read;
        if (ai.update(ak, ak.record)) {
          if (ak.fragmented !== null) {
            if (ak.fragmented.type === ak.record.type) {
              ak.fragmented.fragment.putBuffer(ak.record.fragment);
              ak.record = ak.fragmented
            } else {
              ak.error(ak, {
                message: "Invalid fragmented record.",
                send: true,
                alert: {
                  level: g.Alert.Level.fatal,
                  description: g.Alert.Description.unexpected_message
                }
              })
            }
          }
          ak.record.ready = true
        }
      }
      return aj
    };
    ab.handshake = function (ah) {
      if (ab.entity !== g.ConnectionEnd.client) {
        ab.error(ab, {
          message: "Cannot initiate handshake as a server.",
          fatal: false
        })
      } else {
        if (ab.handshaking) {
          ab.error(ab, {
            message: "Handshake already in progress.",
            fatal: true /*modif Ayms*/
          })
        } else {
          if (ab.fail && !ab.open && ab.handshakes === 0) {
            ab.fail = false
          }
          ab.handshaking = true;
          ah = ah || "";
          var ag = null;
          if (ah.length > 0) {
            if (ab.sessionCache) {
              ag = ab.sessionCache.getSession(ah)
            }
            if (ag === null) {
              ah = ""
            }
          }
          if (ah.length === 0 && ab.sessionCache) {
            ag = ab.sessionCache.getSession();
            if (ag !== null) {
              ah = ag.id
            }
          }
          ab.session = {
            id: ah,
            cipherSuite: null,
            compressionMethod: null,
            serverCertificate: null,
            certificateRequest: null,
            clientCertificate: null,
            sp: ag ? ag.sp : {},
            md5: N.md.md5.create(),
            sha1: N.md.sha1.create()
          };
          ab.session.sp.client_random = g.createRandom().getBytes();
          ab.open = true;
          g.queue(ab, g.createRecord({
            type: g.ContentType.handshake,
            data: g.createClientHello(ab)
          }));
          g.flush(ab)
        }
      }
    };
    ab.process = function (ag) {
      var ah = 0;
      if (ag) {
        ab.input.putBytes(ag)
      };
      if (!ab.fail) {
        if (ab.record !== null && ab.record.ready && ab.record.fragment.isEmpty()) {
          ab.record = null
        }
        if (ab.record === null) {
          ah = ac(ab)
        };
        if (!ab.fail && ab.record !== null && !ab.record.ready) {
          ah = Y(ab)
        };
        if (!ab.fail && ab.record !== null && ab.record.ready) {
          ae(ab, ab.record)
        }
      };
      return ah
    };
    ab.prepare = function (ag) {
      g.queue(ab, g.createRecord({
        type: g.ContentType.application_data,
        data: N.util.createBuffer(ag)
      }));
      return g.flush(ab)
    };
    ab.close = function (ag) {
      if (!ab.fail && ab.sessionCache && ab.session) {
        ab.sessionCache.setSession(ab.session.id, ab.session)
      }
      if (ab.open) {
        ab.open = false;
        ab.input.clear();
        if (ab.isConnected || ab.handshaking) {
          ab.isConnected = ab.handshaking = false;
          g.queue(ab, g.createAlert({
            level: g.Alert.Level.warning,
            description: g.Alert.Description.close_notify
          }));
          g.flush(ab)
        }
        ab.closed(ab)
      }
      ab.reset(ag)
    };
    return ab
  };
  N.tls.prf_tls1 = O;
  N.tls.Alert = g.Alert;
  N.tls.CipherSuites = g.CipherSuites;
  N.tls.createSessionCache = g.createSessionCache;
  N.tls.createConnection = g.createConnection;
})();
(function () {
  var d = {};
  var g = forge; /*if(typeof(window)!=="undefined"){var g=window.forge=window.forge||{}}else{if(typeof(module)!=="undefined"&&module.exports){var g={util:require("./util")};module.exports=d}}*/
  g.md = g.md || {};
  g.md.algorithms = g.md.algorithms || {};
  g.md.md5 = g.md.algorithms.md5 = d;
  var f = null;
  var c = null;
  var i = null;
  var a = null;
  var b = false;
  var e = function () {
    f = String.fromCharCode(128);
    f += g.util.fillString(String.fromCharCode(0), 64);
    c = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 1, 6, 11, 0, 5, 10, 15, 4, 9, 14, 3, 8, 13, 2, 7, 12, 5, 8, 11, 14, 1, 4, 7, 10, 13, 0, 3, 6, 9, 12, 15, 2, 0, 7, 14, 5, 12, 3, 10, 1, 8, 15, 6, 13, 4, 11, 2, 9];
    i = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
    a = new Array(64);
    for (var j = 0; j < 64; ++j) {
      a[j] = Math.floor(Math.abs(Math.sin(j + 1)) * 4294967296)
    }
    b = true
  };
  var h = function (x, u, y) {
    var v, q, p, o, n, m, j, k;
    var l = y.length();
    while (l >= 64) {
      q = x.h0;
      p = x.h1;
      o = x.h2;
      n = x.h3;
      for (k = 0; k < 16; ++k) {
        u[k] = y.getInt32Le();
        m = n ^ (p & (o ^ n));
        v = (q + m + a[k] + u[k]);
        j = i[k];
        q = n;
        n = o;
        o = p;
        p += (v << j) | (v >>> (32 - j))
      }
      for (; k < 32; ++k) {
        m = o ^ (n & (p ^ o));
        v = (q + m + a[k] + u[c[k]]);
        j = i[k];
        q = n;
        n = o;
        o = p;
        p += (v << j) | (v >>> (32 - j))
      }
      for (; k < 48; ++k) {
        m = p ^ o ^ n;
        v = (q + m + a[k] + u[c[k]]);
        j = i[k];
        q = n;
        n = o;
        o = p;
        p += (v << j) | (v >>> (32 - j))
      }
      for (; k < 64; ++k) {
        m = o ^ (p | ~n);
        v = (q + m + a[k] + u[c[k]]);
        j = i[k];
        q = n;
        n = o;
        o = p;
        p += (v << j) | (v >>> (32 - j))
      }
      x.h0 = (x.h0 + q) & 4294967295;
      x.h1 = (x.h1 + p) & 4294967295;
      x.h2 = (x.h2 + o) & 4294967295;
      x.h3 = (x.h3 + n) & 4294967295;
      l -= 64
    }
  };
  d.create = function () {
    if (!b) {
      e()
    }
    var j = null;
    var m = g.util.createBuffer();
    var k = new Array(16);
    var l = {
      algorithm: "md5",
      blockLength: 64,
      digestLength: 16,
      messageLength: 0
    };
    l.start = function () {
      l.messageLength = 0;
      m = g.util.createBuffer();
      j = {
        h0: 1732584193,
        h1: 4023233417,
        h2: 2562383102,
        h3: 271733878
      }
    };
    l.start();
    l.update = function (o, n) {
      if (n === "utf8") {
        o = g.util.encodeUtf8(o)
      }
      l.messageLength += o.length;
      m.putBytes(o);
      h(j, k, m);
      if (m.read > 2048 || m.length() === 0) {
        m.compact()
      }
    };
    l.digest = function () {
      var n = l.messageLength;
      var q = g.util.createBuffer();
      q.putBytes(m.bytes());
      q.putBytes(f.substr(0, 64 - ((n + 8) % 64)));
      q.putInt32Le((n << 3) & 4294967295);
      q.putInt32Le((n >>> 29) & 255);
      var o = {
        h0: j.h0,
        h1: j.h1,
        h2: j.h2,
        h3: j.h3
      };
      h(o, k, q);
      var p = g.util.createBuffer();
      p.putInt32Le(o.h0);
      p.putInt32Le(o.h1);
      p.putInt32Le(o.h2);
      p.putInt32Le(o.h3);
      return p
    };
    return l
  }
})();

//end forge

global.forge = forge;
module.exports = forge;