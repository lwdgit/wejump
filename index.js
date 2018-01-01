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
    await sleep((Math.random() * 200) + 4000)
    var stream = await client.screencap(deviceId)
    var im = await parseStream(stream)
    var [piece_x, piece_y, board_x, board_y] = find_piece_and_board(im)
    if (piece_x === 0) break
    await jump(deviceId, sqrt(abs(board_x - piece_x) ** 2 + abs(board_y - piece_y) ** 2))
    im.pack('out.png')
  }
}
start()

function parseStream (stream) {
  return new Promise((resolve) => {
    stream.pipe(new PNG({
      filterType: 4
    }))
    .on('parsed', function () {
      var self = this
      var im = {
        getpixel(x, y) {
          var idx = (self.width * y + x) << 2
          return [self.data[idx], self.data[idx + 1], self.data[idx + 2]]
        },
        pack (path) {
          return self.pack().pipe(fs.createWriteStream(path))
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

function jump(deviceId, distance) {
  var press_time = distance * 1.40
  var offset = 40 / press_time
  print(new Date() + ' press_time: ' + str(press_time) + ' ' + offset)
  return client.shell(deviceId, 'input swipe 320 410 320 410 ' + Math.round(press_time * (1 + offset)))
}

function all(arr) {
  return arr.every(i => i)
}

function max(...args) {
  return Math.max(...args)
}

function min(...args) {
  return Math.min(...args)
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

  var piece_x_min = w
  var piece_x_max = 0
  var piece_y_max = 0
  var board_x = 0
  var board_y = 0
  var board_x_min = w
  var board_x_max = 0
  var x1 = 0
  var x2 = 0
  
  var ratio = 1.8
  
  for (var i = 300; i <= h; i++) {
    for (var j = 0; j <= w; j++) {
      var pixel = im.getpixel(j, i)
      if ((pixel[0] > 50 && pixel[0] < 60) && (pixel[1] > 50 && pixel[1] < 63) && (pixel[2] > 95 && pixel[2] < 110)) { // 棋子颜色
        // 更改 x 平均值算法
        piece_x_min = min(j, piece_x_min)
        piece_x_max = max(j, piece_x_max)
        piece_y_max = i
      }
    }
  }

  if (piece_x_max < piece_x_min) {
    return [0, 0, 0, 0]
  }
  var piece_x = (piece_x_min + piece_x_max) / 2
  var piece_y = piece_y_max - (piece_x_max - piece_x_min) / ratio  // 计算底盘

  var bg_pixel = im.getpixel(300, 0)
  for (var i = 300; i < piece_y; i++) {
    board_x_min = w
    board_x_max = 0
    for (var j = 0; j <= w; j++) {
      if (abs(j - piece_x_min) < 40 || abs(j - piece_x_max) < 40) { // 处理header
        continue
      }
      var pixel = im.getpixel(j, i)
      if (abs(pixel[0] - bg_pixel[0]) + abs(pixel[1] - bg_pixel[1]) + abs(pixel[2] - bg_pixel[2]) < 30) { // 处理渐变背景色
        bg_pixel = pixel
      } else { // 如果还没找到水平中点，则
        board_x_max = max(board_x_max, j)
        board_x_min = min(board_x_min, j)
      }
    }
    if (board_x_max >= board_x_min) {
      board_y_min = i
      break
    }
  }

  if (board_x_max < board_x_min) {
    return [0, 0, 0, 0]
  }

  // if (board_x_max - board_x_min > 5) {
  //   console.log('这是一个椭圆')
  // } else {
  //   console.log('这是一个方形')
  // }
  board_x = (board_x_max + board_x_min) / 2

  if (!board_y_min) {
    return [0, 0, 0, 0]
  }
  board_y = piece_y - abs(board_x - piece_x) / ratio
  return [piece_x, piece_y, board_x, board_y]
}