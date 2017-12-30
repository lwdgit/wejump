#!/usr/bin/env node

var adb = require('adbkit')
var client = adb.createClient()
var PNG = require('pngjs').PNG
var fs = require('fs')
var assert = require('assert')

function sleep (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}


async function start() {
  var devices = await client.listDevices()
  assert(devices && devices.length, '没有检测到安卓设备')
  var deviceId = devices[0].id
  while (1) {
    await sleep((Math.random() * 200) + 3000)
    var stream = await client.screencap(deviceId)
    var im = await parseStream(stream)
    var [piece_x, piece_y, board_x, board_y] = find_piece_and_board(im)
    jump(deviceId, sqrt(abs(board_x - piece_x) ** 2 + abs(board_y - piece_y) ** 2))
  }
}
start()

function parseStream (stream) {
  return new Promise((resolve) => {
    stream.pipe(new PNG({
      filterType: 4
    }))
    .on('parsed', function () {
      // this.pack().pipe(fs.createWriteStream('out.png'));
      var self = this
      var im = {
        getpixel(x, y) {
          var idx = (self.width * y + x) << 2
          return [self.data[idx], self.data[idx + 1], self.data[idx + 2]]
        }
      }
      Object.defineProperties(im, {
        size: {
          get() {
            return [self.width, self.height]
          }
        }
      })
      resolve(im)
    })
  })
}

function print() {
  return console.log.apply(console, arguments)
}
function str (num) {
  return new String(num)
}
function int (str) {
  return parseInt(str, 10)
}

var old = 1
function jump(deviceId, distance) {
  var press_time = distance * 1.450
  print(new Date() + ' press_time: ' + str(press_time))
  press_time = int(press_time)
  if (press_time > 300 || old === press_time) {
    old = 1
    client.shell(deviceId, 'input swipe 320 410 320 410 ' + str(press_time))
  } else {
    old = press_time
  }
}

function all(arr) {
  return arr.every(i => i)
}

function max(...args) {
  return Math.max(...args)
}

function abs(...args) {
  return Math.abs(...args)
}

function range(num) {
  return Array.from(new Array(num), (k, i) => i)
}

function sqrt (...args) {
  return Math.sqrt(...args)
}

function find_piece_and_board(im) {
  var [w, h] = im.size

  var piece_x_sum = 0
  var piece_x_c = 0
  var piece_y_max = 0
  var board_x = 0
  var board_y = 0

  for (var i of range(h)) {
    for (var j of range(w)) {
      var pixel = im.getpixel(j, i)
      // 根据棋子的最低行的颜色判断，找最后一行那些点的平均值
      // print(pixel[0])
      if ((pixel[0] > 50 && pixel[0] < 60) && (pixel[1] > 53 && pixel[1] < 63) && (pixel[2] > 95 && pixel[2] < 110)) {
        piece_x_sum += j
        piece_x_c += 1
        piece_y_max = max(i, piece_y_max)
      }
    }
  }
  if (!all([piece_x_sum, piece_x_c])) {
    return [0, 0, 0, 0]
  }
  var piece_x = piece_x_sum / piece_x_c
  // TODO: 大小根据截图的 size 来计算
  var piece_y = piece_y_max - 20  // 上移棋子底盘高度的一半

  for (var i of range(h)) {
    if (i < 300) {
      continue
    }
    var last_pixel = im.getpixel(0, i)
    if (board_x || board_y) {
      break
    }
    board_x_sum = 0
    board_x_c = 0


    for (var j of range(w)) {
      var pixel = im.getpixel(j, i)
      // 修掉脑袋比下一个小格子还高的情况的 bug
      if (abs(j - piece_x) < 70) {
        continue
      }

      // 修掉圆顶的时候一条线导致的小 bug
      if (abs(pixel[0] - last_pixel[0]) + abs(pixel[1] - last_pixel[1]) + abs(pixel[2] - last_pixel[2]) > 10) {
        board_x_sum += j
        board_x_c += 1
      }
      if (board_x_sum) {
        board_x = board_x_sum / board_x_c
      }
    }
  }

  board_y = piece_y + abs(board_x - piece_x) * abs(1122 - 831) / abs(813 - 310)   // 按实际的角度来算，找到接近下一个 board 中心的坐标

  if (!all([board_x, board_y])) {
    return [0, 0, 0, 0]
  }
  return [piece_x, piece_y, board_x, board_y]
}