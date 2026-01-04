import { useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'
import * as CANNON from 'cannon-es'

const FRUSTUM_SIZE = 24
const PALETTE = ["#C9A96E", "#D4AF37", "#B8860B", "#DAA520", "#FFD700"]
const COMMON_COLORS = { 
  text: "#F5F5DC",
  outline: "#1C1C1C",
  shadow: "#2C2416"
}
const TABLE_HEIGHT = 1.0
const TABLE_RADIUS = 6

// Positive fortune messages
const FORTUNES = [
  { kanji: "大吉", meaning: "Great Blessing" },
  { kanji: "吉", meaning: "Good Fortune" },
  { kanji: "中吉", meaning: "Middle Blessing" },
  { kanji: "小吉", meaning: "Small Blessing" },
  { kanji: "末吉", meaning: "Future Blessing" },
  { kanji: "福", meaning: "Happiness" },
  { kanji: "幸", meaning: "Joy" },
  { kanji: "愛", meaning: "Love" },
  { kanji: "運", meaning: "Luck" },
  { kanji: "夢", meaning: "Dreams" },
]

const coinSounds = []
const loadCoinSounds = () => {
  for (let i = 0; i < 5; i++) {
    const audio = new Audio('https://cdn.freesound.org/previews/411/411089_5121236-lq.mp3')
    audio.volume = 0.3
    coinSounds.push(audio)
  }
}

let soundIndex = 0
const playCoinSound = () => {
  if (coinSounds.length === 0) return
  const sound = coinSounds[soundIndex % coinSounds.length]
  sound.currentTime = 0
  sound.play().catch(() => {})
  soundIndex++
}

function CoinGame({ coinCount, onResult, onPowerChange }) {
  const containerRef = useRef(null)
  const sceneRef = useRef(null)
  const cameraRef = useRef(null)
  const rendererRef = useRef(null)
  const worldRef = useRef(null)
  const coinObjectsRef = useRef([])
  const isHoldingRef = useRef(false)
  const needsResultCheckRef = useRef(false)
  const animationIdRef = useRef(null)
  const lastCollisionTimeRef = useRef({})
  const soundsLoadedRef = useRef(false)
  const powerRef = useRef(0)
  const powerDirectionRef = useRef(1)
  const mouseRef = useRef(new THREE.Vector2())
  const clickPositionRef = useRef(new THREE.Vector3())
  const raycasterRef = useRef(new THREE.Raycaster())
  const dragPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), -8))

  const createCoinTexture = useCallback((fortune, colorHex) => {
    const size = 512
    const canvas = document.createElement("canvas")
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext("2d")

    ctx.beginPath()
    ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2)
    ctx.fillStyle = colorHex
    ctx.fill()

    ctx.beginPath()
    ctx.arc(size/2, size/2, size/2 - 25, 0, Math.PI * 2)
    ctx.lineWidth = 6
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)"
    ctx.stroke()

    const holeSize = 50
    ctx.fillStyle = "#1C1C1C"
    ctx.fillRect(size/2 - holeSize/2, size/2 - holeSize/2, holeSize, holeSize)

    ctx.fillStyle = COMMON_COLORS.text
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.font = "bold 100px 'Noto Serif JP', serif"
    
    ctx.save()
    ctx.shadowColor = "rgba(0,0,0,0.4)"
    ctx.shadowBlur = 4
    ctx.shadowOffsetX = 2
    ctx.shadowOffsetY = 2
    ctx.fillText(fortune.kanji, size/2, size/2 - 90)
    ctx.restore()

    return new THREE.CanvasTexture(canvas)
  }, [])

  const randomizeFortunes = useCallback(() => {
    const scene = sceneRef.current
    if (!scene) return

    // Shuffle fortunes to ensure unique ones for each coin
    const shuffled = [...FORTUNES].sort(() => Math.random() - 0.5)

    coinObjectsRef.current.forEach((obj, i) => {
      const fortune = shuffled[i % shuffled.length]
      const randomColor = PALETTE[Math.floor(Math.random() * PALETTE.length)]
      
      // Update fortune reference
      obj.fortune = fortune
      
      // Update textures
      if (obj.mesh.material) {
        obj.mesh.material.forEach((m, idx) => {
          if (m.map) m.map.dispose()
          if (idx === 1 || idx === 2) { // top and bottom faces
            m.map = createCoinTexture(fortune, randomColor)
            m.needsUpdate = true
          }
          if (idx === 0) { // side
            m.color = new THREE.Color(randomColor).multiplyScalar(0.7)
          }
        })
      }
    })
  }, [createCoinTexture])

  const applyTossForce = useCallback((body, power) => {
    // Calculate direction from current position toward table center
    const toTableX = 0 - body.position.x
    const toTableZ = 0 - body.position.z
    
    // Distance to table center
    const dist = Math.sqrt(toTableX * toTableX + toTableZ * toTableZ) || 1
    
    // Force multiplier based on power and distance
    const baseForceMult = 4 + power * 10
    const distanceFactor = Math.min(dist / 10, 1.5)
    const forceMult = baseForceMult * distanceFactor
    
    // Apply velocity toward table center with upward arc
    body.velocity.set(
      (toTableX / dist) * forceMult + (Math.random() - 0.5) * 2,
      5 + power * 5,
      (toTableZ / dist) * forceMult + (Math.random() - 0.5) * 2
    )
    
    // Spin the coin
    body.angularVelocity.set(
      (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 8,
      (Math.random() - 0.5) * 20
    )
  }, [])

  const calculateResult = useCallback(() => {
    const landedCoins = []

    coinObjectsRef.current.forEach(({ body, fortune }) => {
      const distFromCenter = Math.sqrt(body.position.x ** 2 + body.position.z ** 2)
      const isOnTable = distFromCenter < TABLE_RADIUS && body.position.y > TABLE_HEIGHT - 0.5

      if (isOnTable) {
        landedCoins.push(fortune)
      }
    })

    if (landedCoins.length === 0) {
      onResult({ main: "再挑戦", detail: "", show: true })
    } else if (landedCoins.length === 1) {
      // Single coin - show kanji as main, meaning as detail
      onResult({ main: landedCoins[0].kanji, detail: landedCoins[0].meaning, show: true })
    } else {
      // Show all landed coins' fortunes
      const kanjiList = landedCoins.map(f => f.kanji).join(" • ")
      onResult({ 
        main: `${landedCoins.length}枚成功`, 
        detail: kanjiList, 
        show: true 
      })
    }
    needsResultCheckRef.current = false
  }, [onResult])

  const releaseCoins = useCallback(() => {
    playCoinSound()
    randomizeFortunes() // Randomize fortunes each toss
    const power = powerRef.current
    coinObjectsRef.current.forEach((obj) => {
      obj.body.wakeUp()
      applyTossForce(obj.body, power)
    })
    setTimeout(() => { needsResultCheckRef.current = true }, 1000)
  }, [applyTossForce, randomizeFortunes])

  const updateCoinCount = useCallback((count) => {
    const scene = sceneRef.current
    const world = worldRef.current
    if (!scene || !world) return

    coinObjectsRef.current.forEach((obj) => {
      scene.remove(obj.mesh)
      scene.remove(obj.outline)
      scene.remove(obj.shadow)
      world.removeBody(obj.body)
      if (obj.mesh.material) {
        obj.mesh.material.forEach(m => {
          if (m.map) m.map.dispose()
          m.dispose()
        })
      }
    })
    coinObjectsRef.current = []
    onResult({ main: '', detail: '', show: false })

    const radius = 1.8, thickness = 0.4, segments = 32
    const geometry = new THREE.CylinderGeometry(radius, radius, thickness, segments)
    const outlineGeo = new THREE.CylinderGeometry(radius * 1.05, radius * 1.05, thickness * 1.05, segments)
    const shadowGeo = new THREE.CircleGeometry(radius, 32)
    const shape = new CANNON.Cylinder(radius, radius, thickness, segments)
    const shapeQ = new CANNON.Quaternion()
    shapeQ.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2)

    const outlineMat = new THREE.MeshBasicMaterial({ color: COMMON_COLORS.outline, side: THREE.BackSide })
    const shadowMat = new THREE.MeshBasicMaterial({ color: COMMON_COLORS.shadow, transparent: true, opacity: 0.3 })

    for (let i = 0; i < count; i++) {
      const randomColor = PALETTE[Math.floor(Math.random() * PALETTE.length)]
      const fortune = FORTUNES[Math.floor(Math.random() * FORTUNES.length)]
      
      const sideMat = new THREE.MeshStandardMaterial({ 
        color: new THREE.Color(randomColor).multiplyScalar(0.7),
        metalness: 0.6,
        roughness: 0.3
      })
      const topMat = new THREE.MeshBasicMaterial({ map: createCoinTexture(fortune, randomColor) })
      const bottomMat = new THREE.MeshBasicMaterial({ map: createCoinTexture(fortune, randomColor) })

      const mesh = new THREE.Mesh(geometry, [sideMat, topMat, bottomMat])
      mesh.castShadow = true
      mesh.receiveShadow = true
      scene.add(mesh)

      const outline = new THREE.Mesh(outlineGeo, outlineMat)
      scene.add(outline)

      const shadow = new THREE.Mesh(shadowGeo, shadowMat.clone())
      shadow.rotation.x = -Math.PI / 2
      scene.add(shadow)

      const startX = (i - (count - 1) / 2) * 2.5
      const body = new CANNON.Body({
        mass: 3,
        position: new CANNON.Vec3(startX, TABLE_HEIGHT + 6, -5),
        sleepSpeedLimit: 0.3,
        sleepTimeLimit: 0.5
      })
      body.addShape(shape, new CANNON.Vec3(0, 0, 0), shapeQ)
      body.quaternion.setFromEuler(Math.PI / 2, 0, 0)
      world.addBody(body)

      coinObjectsRef.current.push({ mesh, outline, shadow, body, fortune })
    }
  }, [createCoinTexture, onResult])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color("#E8E4D9")
    sceneRef.current = scene

    const aspect = window.innerWidth / window.innerHeight
    const camera = new THREE.OrthographicCamera(
      (FRUSTUM_SIZE * aspect) / -2, (FRUSTUM_SIZE * aspect) / 2,
      FRUSTUM_SIZE / 2, FRUSTUM_SIZE / -2, 1, 1000
    )
    camera.position.set(0, 35, 25)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    const ambientLight = new THREE.AmbientLight(0xFFF8E7, 0.9)
    scene.add(ambientLight)
    const dirLight = new THREE.DirectionalLight(0xFFE4C4, 0.7)
    dirLight.position.set(5, 20, 10)
    dirLight.castShadow = true
    scene.add(dirLight)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.domElement.style.touchAction = 'none'
    renderer.domElement.style.userSelect = 'none'
    renderer.shadowMap.enabled = true
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const world = new CANNON.World()
    world.gravity.set(0, -25, 0)
    world.broadphase = new CANNON.NaiveBroadphase()
    world.solver.iterations = 30
    world.allowSleep = true
    worldRef.current = world

    const tableMat = new CANNON.Material()
    const coinMat = new CANNON.Material()
    world.addContactMaterial(new CANNON.ContactMaterial(tableMat, coinMat, {
      friction: 0.6, restitution: 0.3
    }))
    world.addContactMaterial(new CANNON.ContactMaterial(coinMat, coinMat, { 
      friction: 0.4, restitution: 0.4 
    }))

    world.addEventListener('postStep', () => {
      const now = performance.now()
      world.contacts.forEach((contact) => {
        const impactVelocity = contact.getImpactVelocityAlongNormal()
        if (Math.abs(impactVelocity) > 1.5) {
          const key = `${contact.bi.id}-${contact.bj.id}`
          if (!lastCollisionTimeRef.current[key] || now - lastCollisionTimeRef.current[key] > 100) {
            lastCollisionTimeRef.current[key] = now
            playCoinSound()
          }
        }
      })
    })

    // Japanese style table (Chabudai)
    // Table top - dark lacquered wood
    const tableThickness = 0.3
    const tableGeo = new THREE.CylinderGeometry(TABLE_RADIUS, TABLE_RADIUS, tableThickness, 64)
    const tableTopMat = new THREE.MeshStandardMaterial({ 
      color: '#1A0F0A',
      roughness: 0.15,
      metalness: 0.2
    })
    const tableMesh = new THREE.Mesh(tableGeo, tableTopMat)
    tableMesh.position.y = TABLE_HEIGHT - tableThickness / 2
    tableMesh.receiveShadow = true
    scene.add(tableMesh)

    // Table rim - gold lacquer edge
    const rimGeo = new THREE.TorusGeometry(TABLE_RADIUS, 0.15, 16, 64)
    const rimMat = new THREE.MeshStandardMaterial({ color: '#C9A96E', metalness: 0.6, roughness: 0.2 })
    const rimMesh = new THREE.Mesh(rimGeo, rimMat)
    rimMesh.rotation.x = Math.PI / 2
    rimMesh.position.y = TABLE_HEIGHT
    scene.add(rimMesh)

    // Inner gold ring
    const innerRimGeo = new THREE.TorusGeometry(TABLE_RADIUS - 0.8, 0.06, 16, 64)
    const innerRim = new THREE.Mesh(innerRimGeo, rimMat)
    innerRim.rotation.x = Math.PI / 2
    innerRim.position.y = TABLE_HEIGHT + 0.01
    scene.add(innerRim)

    // Center decorative pattern
    const centerGeo = new THREE.CircleGeometry(1.2, 64)
    const centerMat = new THREE.MeshBasicMaterial({ color: '#2A1A12' })
    const center = new THREE.Mesh(centerGeo, centerMat)
    center.rotation.x = -Math.PI / 2
    center.position.y = TABLE_HEIGHT + 0.01
    scene.add(center)

    // Decorative ring pattern
    const patternGeo = new THREE.RingGeometry(2.2, 2.4, 64)
    const patternMat = new THREE.MeshBasicMaterial({ color: '#8B4513', side: THREE.DoubleSide })
    const pattern = new THREE.Mesh(patternGeo, patternMat)
    pattern.rotation.x = -Math.PI / 2
    pattern.position.y = TABLE_HEIGHT + 0.01
    scene.add(pattern)

    // Outer decorative ring
    const outerPatternGeo = new THREE.RingGeometry(4.2, 4.4, 64)
    const outerPattern = new THREE.Mesh(outerPatternGeo, patternMat)
    outerPattern.rotation.x = -Math.PI / 2
    outerPattern.position.y = TABLE_HEIGHT + 0.01
    scene.add(outerPattern)

    // Table physics - use thick box for reliable collision
    const tableBody = new CANNON.Body({ mass: 0, material: tableMat })
    const tableBoxShape = new CANNON.Box(new CANNON.Vec3(TABLE_RADIUS, 1, TABLE_RADIUS))
    tableBody.addShape(tableBoxShape)
    tableBody.position.set(0, TABLE_HEIGHT - 1, 0)
    world.addBody(tableBody)

    // Floor
    const floorBody = new CANNON.Body({ mass: 0, material: tableMat })
    floorBody.addShape(new CANNON.Plane())
    floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2)
    floorBody.position.y = -5
    world.addBody(floorBody)

    return () => {
      cancelAnimationFrame(animationIdRef.current)
      renderer.dispose()
      container.removeChild(renderer.domElement)
    }
  }, [])

  useEffect(() => {
    if (worldRef.current) updateCoinCount(coinCount)
  }, [coinCount, updateCoinCount])

  // Animation loop
  useEffect(() => {
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate)
      const world = worldRef.current
      const camera = cameraRef.current
      const renderer = rendererRef.current
      const scene = sceneRef.current
      if (!world || !camera || !renderer || !scene) return

      // Power bar oscillation when holding
      if (isHoldingRef.current) {
        powerRef.current += powerDirectionRef.current * 0.02
        if (powerRef.current >= 1) {
          powerRef.current = 1
          powerDirectionRef.current = -1
        } else if (powerRef.current <= 0) {
          powerRef.current = 0
          powerDirectionRef.current = 1
        }
        onPowerChange(powerRef.current)

        // Get click position in 3D space
        raycasterRef.current.setFromCamera(mouseRef.current, camera)
        const targetPoint = new THREE.Vector3()
        raycasterRef.current.ray.intersectPlane(dragPlaneRef.current, targetPoint)
        clickPositionRef.current.copy(targetPoint)

        // Float coins at click position
        const time = performance.now() * 0.003
        coinObjectsRef.current.forEach((obj, i) => {
          const offsetX = (i - (coinObjectsRef.current.length - 1) / 2) * 2
          const floatY = Math.sin(time + i) * 0.3
          obj.body.position.x = targetPoint.x + offsetX
          obj.body.position.y = 8 + floatY
          obj.body.position.z = targetPoint.z
          obj.body.quaternion.setFromEuler(Math.PI / 2, time * 3 + i, 0)
          obj.body.velocity.set(0, 0, 0)
          obj.body.angularVelocity.set(0, 0, 0)
        })
      }

      world.step(1 / 60)

      // Update visuals
      coinObjectsRef.current.forEach(({ mesh, outline, shadow, body }) => {
        mesh.position.copy(body.position)
        mesh.quaternion.copy(body.quaternion)
        mesh.rotateX(Math.PI / 2)
        outline.position.copy(mesh.position)
        outline.quaternion.copy(mesh.quaternion)
        
        // Shadow on table or floor
        shadow.position.x = body.position.x
        shadow.position.z = body.position.z
        const distFromCenter = Math.sqrt(body.position.x ** 2 + body.position.z ** 2)
        if (distFromCenter < TABLE_RADIUS && body.position.y > TABLE_HEIGHT) {
          shadow.position.y = TABLE_HEIGHT + 0.02
        } else {
          shadow.position.y = -4.99
        }
        
        const height = Math.max(0, body.position.y - shadow.position.y)
        const scale = Math.max(0.3, 1 - height * 0.05)
        const opacity = Math.max(0, 0.4 - height * 0.02)
        shadow.scale.setScalar(scale)
        shadow.material.opacity = opacity
      })

      // Check results
      if (needsResultCheckRef.current) {
        let allStopped = true
        for (const o of coinObjectsRef.current) {
          if (o.body.velocity.lengthSquared() > 0.1 || o.body.angularVelocity.lengthSquared() > 0.1) {
            allStopped = false
            break
          }
        }
        if (allStopped) calculateResult()
      }

      renderer.render(scene, camera)
    }
    animate()
  }, [calculateResult, onPowerChange])

  // Event handlers
  useEffect(() => {
    const updateMousePosition = (e) => {
      let x, y
      if (e.touches) {
        x = e.touches[0].clientX
        y = e.touches[0].clientY
      } else {
        x = e.clientX
        y = e.clientY
      }
      mouseRef.current.x = (x / window.innerWidth) * 2 - 1
      mouseRef.current.y = -(y / window.innerHeight) * 2 + 1
    }

    const onInputStart = (e) => {
      if (e.target.closest(".top-bar") || e.target.closest(".power-bar-container")) return
      if (e.preventDefault) e.preventDefault()
      
      if (!soundsLoadedRef.current) {
        loadCoinSounds()
        soundsLoadedRef.current = true
      }

      updateMousePosition(e)
      
      isHoldingRef.current = true
      powerRef.current = 0
      powerDirectionRef.current = 1
      needsResultCheckRef.current = false
      onResult({ main: '', detail: '', show: false })
      onPowerChange(0)
    }

    const onInputMove = (e) => {
      if (!isHoldingRef.current) return
      updateMousePosition(e)
    }

    const onInputEnd = () => {
      if (!isHoldingRef.current) return
      isHoldingRef.current = false
      onPowerChange(-1) // Hide power bar
      releaseCoins()
    }

    const onWindowResize = () => {
      const camera = cameraRef.current
      const renderer = rendererRef.current
      if (!camera || !renderer) return
      const aspect = window.innerWidth / window.innerHeight
      camera.left = (-FRUSTUM_SIZE * aspect) / 2
      camera.right = (FRUSTUM_SIZE * aspect) / 2
      camera.top = FRUSTUM_SIZE / 2
      camera.bottom = -FRUSTUM_SIZE / 2
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }

    window.addEventListener("resize", onWindowResize)
    window.addEventListener("mousedown", onInputStart)
    window.addEventListener("mousemove", onInputMove)
    window.addEventListener("mouseup", onInputEnd)
    document.body.addEventListener("mouseleave", onInputEnd)
    window.addEventListener("touchstart", onInputStart, { passive: false })
    window.addEventListener("touchmove", onInputMove, { passive: false })
    window.addEventListener("touchend", onInputEnd)

    return () => {
      window.removeEventListener("resize", onWindowResize)
      window.removeEventListener("mousedown", onInputStart)
      window.removeEventListener("mousemove", onInputMove)
      window.removeEventListener("mouseup", onInputEnd)
      document.body.removeEventListener("mouseleave", onInputEnd)
      window.removeEventListener("touchstart", onInputStart)
      window.removeEventListener("touchmove", onInputMove)
      window.removeEventListener("touchend", onInputEnd)
    }
  }, [onResult, onPowerChange, releaseCoins])

  return <div ref={containerRef} style={{ width: '100%', height: '100vh' }} />
}

export default CoinGame
