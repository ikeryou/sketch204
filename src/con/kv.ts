import { Func } from "../core/func";
import { Update } from "../libs/update";
import { Util } from "../libs/util";
import { Canvas } from "../webgl/canvas";
import { Param } from "../core/param";
import { Conf } from "../core/conf";
import { EdgesGeometry } from 'three/src/geometries/EdgesGeometry';
import { Vector3 } from "three/src/math/Vector3";
import { Color } from "three/src/math/Color";
import { Mouse } from "../core/mouse";
import { HSL } from "../libs/HSL";
import { ShapeGeometry } from 'three/src/geometries/ShapeGeometry';
import { Shape } from 'three/src/extras/core/Shape';
import { AmbientLight } from 'three/src/lights/AmbientLight';
import { DirectionalLight } from 'three/src/lights/DirectionalLight';
import { Item } from "./item";
import { Raycaster } from "three/src/core/Raycaster";
import { noise } from "./noise";
import { Particle } from "./particle";


export class Kv extends Canvas {

  private _light:DirectionalLight
  private _ambLight:AmbientLight
  private _bgColor:Color = new Color()
  private _noiseColor:Color = new Color()
  private _item:Array<Item> = []
  private _heart:ShapeGeometry
  private _heartEdge:EdgesGeometry
  private _ray:Raycaster | undefined
  private _lineNumTable:Array<number> = [2, 3, 4, 5]
  private _noise:noise
  private _changeCnt:number = 1
  private _pt:Particle

  constructor(opt:any = {}) {
    super(opt)

    Util.instance.shuffle(this._lineNumTable)
    this._makeUseColor()

    this._light = new DirectionalLight(0xffffff, 1)
    this.mainScene.add(this._light)

    this._ambLight = new AmbientLight(Util.instance.randomArr(Param.instance.colors), 0.5)
    this.mainScene.add(this._ambLight)

    // 共通でつかうハートを作成
    let x = -25
    let y = -45
    var heartShape = new Shape();
    heartShape.moveTo( x + 25, y + 25 )
    heartShape.bezierCurveTo( x + 25, y + 25, x + 20, y, x, y )
    heartShape.bezierCurveTo( x - 30, y, x - 30, y + 35, x - 30, y + 35 )
    heartShape.bezierCurveTo( x - 30, y + 55, x - 10, y + 77, x + 25, y + 95 )
    heartShape.bezierCurveTo( x + 60, y + 77, x + 80, y + 55, x + 80, y + 35 )
    heartShape.bezierCurveTo( x + 80, y + 35, x + 80, y, x + 50, y )
    heartShape.bezierCurveTo( x + 35, y, x + 25, y + 25, x + 25, y + 25 )
    this._heart = new ShapeGeometry(heartShape)
    this._heartEdge = new EdgesGeometry(this._heart)

    // パーティクル
    this._pt = new Particle({
      heart:this._heart,
      heartEdge:this._heartEdge
    })
    this.mainScene.add(this._pt)

    for(let i = 0; i < 2; i++) {
      const item = new Item({
        id:i,
        heart:this._heart,
        heartEdge:this._heartEdge
      })
      this.mainScene.add(item)
      this._item.push(item)
    }

    // ノイズ
    this._noise = new noise()
    this.mainScene.add(this._noise)

    this._changeScene()
    this._resize()
  }


  private _changeScene():void {
    this._makeUseColor()

    Param.instance.baseSize.scale.value == 100

    this._item.forEach((val) => {
      val.updateColor()
    })

    // this._pt.updateColor()

    this._changeCnt++
  }


  _update():void {
    const w = Func.instance.sw()
    const h = Func.instance.sh()

    const mx = Mouse.instance.normal.x * w * 0.5
    const my = Mouse.instance.normal.y * h * 0.5

    // オートダンスパラメータ
    const spring = 0.1
    const fric = 0.6
    Param.instance.vMx += (Param.instance.tMx - Param.instance.mx) * spring
    Param.instance.vMy += (Param.instance.tMy - Param.instance.my) * spring
    Param.instance.mx += (Param.instance.vMx *= fric)
    Param.instance.my += (Param.instance.vMy *= fric)
    if(Update.instance.cnt % 30 == 0) {
      if(Param.instance.tMx < 0) {
        Param.instance.tMx = Util.instance.random(0.1, 0.8)
      } else {
        Param.instance.tMx = Util.instance.random(0.1, 0.8) * -1
      }
      if(Param.instance.tMy < 0) {
        Param.instance.tMy = Util.instance.random(0.1, 0.8)
      } else {
        Param.instance.tMy = Util.instance.random(0.1, 0.8) * -1
      }
    }

    if(Update.instance.cnt % 120 == 0) {
      this._changeScene()
    }

    // マウス判定用
    const pos = new Vector3(mx, my * -1, 1)
    this._ray = new Raycaster(this.camera.position, pos.sub(this.camera.position).normalize())

    let isHover = false;
    this._item.forEach((val,i) => {
      if(Func.instance.isLG()) {
        val.position.x = w * 0.15 * (i == 0 ? 1 : -1)
        val.position.y = 0
      } else {
        val.position.x = 0
        val.position.y = w * 0.25 * (i == 0 ? 1 : -1)
      }


      val.isHover = false
      if(this._ray != undefined) {
        const hit = this._ray.intersectObject(val.testMesh)
        if(hit.length > 0) {
          if(Conf.instance.USE_TOUCH) {
            if(Mouse.instance.isDown) {
              val.isHover = true
              isHover = true;
            }
          } else {
            val.isHover = true
            isHover = true;
          }
        }
      }
    })


    if(isHover) {
      document.body.classList.add('-pointer')
    } else {
      document.body.classList.remove('-pointer')
    }

    this._noise.setColor(this._noiseColor)

    this._light.position.x = w * Param.instance.light.x.value * 0.01
    this._light.position.y = h * Param.instance.light.y.value * 0.01
    this._light.position.z = w * Param.instance.light.z.value * 0.01

    if(this.isNowRenderFrame()) {
      this._render()
    }
  }


  _render():void {
    if(Conf.instance.IS_SP && Update.instance.cnt % 60 == 0) {
      this._resize(false)
    }

    this.renderer.setClearColor(this._bgColor, 1)

    this.renderer.clearColor()
    this.renderer.render(this.mainScene, this.camera)
  }


  isNowRenderFrame():boolean {
      return this.isRender && (Update.instance.cnt % 1 == 0)
  }


  _resize(isRender:boolean = true):void {
    super._resize()

    const w = Func.instance.sw()
    const h = Func.instance.sh()

    this.renderSize.width = w
    this.renderSize.height = h

    this.updateCamera(this.camera, w, h)

    let pixelRatio:number = Func.instance.ratio()
    this.renderer.setPixelRatio(pixelRatio)
    this.renderer.setSize(w, h)
    this.renderer.clear()

    if(isRender) {
      this._render()
    }
  }


  private _makeUseColor():void {
    Param.instance.colors = []

    this._makeColor()
    this._makeColor()

    this._bgColor = Param.instance.colors[0]
    let hsl = new HSL()
    this._bgColor.getHSL(hsl)
    let brightness = 0.1
    if(this._changeCnt % 2 == 0) brightness = 0.5
    hsl.l *= brightness
    // hsl.s *= brightness
    this._bgColor.setHSL(hsl.h, hsl.s, hsl.l)
    Param.instance.colors.shift()

    this._noiseColor = Param.instance.colors[0]
    hsl = new HSL()
    this._noiseColor.getHSL(hsl)
    brightness = 1
    hsl.l = 80
    hsl.s = 50
    this._noiseColor.setHSL(hsl.h, hsl.s, hsl.l)
    Param.instance.colors.shift()

    Conf.instance.SHADOW_COLOR = this._bgColor
  }


  private _makeColor():void {
    const saturation = Util.instance.randomInt(50, 80)
    const brightness = 50

    const colorNum = Util.instance.randomInt(5, 40)
    const colorInterval = Util.instance.randomInt(5, 20)
    let colorStart = Util.instance.randomInt(0, 360)
    for(let i = 0; i < colorNum; i++) {
      if(Util.instance.hit(4)) {
        const g = Util.instance.random(0, 1)
        Param.instance.colors.push(new Color(g,g,g))
      } else {
        let h = colorStart
        h += i * colorInterval
        h = h % 360

        let s = saturation
        let l = brightness
        Param.instance.colors.push(new Color('hsl(' + h + ', ' + s + '%, ' + l + '%)'))
      }
    }
  }

}