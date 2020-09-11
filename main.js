'use strict';

const showcase = document.getElementById('showcase')
const canvas = document.getElementById('canvas')
const WIDTH = showcase.clientWidth
const HEIGHT = showcase.clientHeight
console.log(WIDTH, HEIGHT)
canvas.width = WIDTH
canvas.height = HEIGHT
const context = canvas.getContext('2d')

function norm2(p1, p2) {
    return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)
}

function genr(a, b) {
    return Math.random() * (b - a) + a
}

function genr2(a, b) {
    return [genr(a, b), genr(a, b)]
}

function randloc(size_x, size_y) {
    const loc = {x: genr(0, size_x), y: genr(0, size_y)}
    return loc
}

class Node {
    constructor(pos, v, dst) {
        this.pos = pos
        this.node_update(v, dst)
        this.allowable_error = 1
    }

    node_update(v, dst) {
        const normalize = v / norm2(this.pos, dst)
        this.dst = dst
        this.v = { x: normalize * (dst.x - this.pos.x), y: normalize * (dst.y - this.pos.y) }
        this.coffeebreak = 0
    }

    move(dt) {
        if (this.coffeebreak > 0) {
            this.coffeebreak -= dt
            if (this.coffeebreak <= 0) return 1
            return 0
        }

        this.pos.x += this.v.x * dt
        this.pos.y += this.v.y * dt

        if (norm2(this.pos, this.dst) <= this.allowable_error) return 2
        return 0
    }
}

class RandomWaypointModel {
    constructor(n_nodes, field_size, velocity, coffeebreak) {
        this.n_nodes = n_nodes
        this.field_size = field_size
        this.velocity = velocity
        this.coffeebreak = coffeebreak
        this.dt = 0.1

        this.nodes = []
        for (var n = 0; n < this.n_nodes; n++) {
            const node = new Node(randloc(this.field_size.x, this.field_size.y),
                                  genr(this.velocity.min, this.velocity.max),
                                  randloc(this.field_size.x, this.field_size.y))
            this.nodes.push(node)
        }
    }

    update() {
        for (var n = 0; n < this.n_nodes; n++) {
            const node = this.nodes[n]
            switch (node.move(this.dt)) {
                case 1:
                    node.node_update(genr(this.velocity.min, this.velocity.max),
                                     randloc(this.field_size.x, this.field_size.y))
                    break
                case 2:
                    node.coffeebreak = genr(this.coffeebreak.min, this.coffeebreak.max)
                    break
            }
        }
    }

    step(delta) {
        var count = 0;
        while (count * this.dt <= delta) {
            this.update()
            count += 1
        }

        for (var n = 0; n < this.n_nodes; n++) {
            const node = this.nodes[n]
            context.beginPath()
            context.fillStyle = 'rgb(0,0,0)'
            context.arc(node.pos.x, node.pos.y, 10, 0, 2 * Math.PI)
            context.fill();
        }
    }
}

const field_size = { x: WIDTH, y: HEIGHT }
const velocity = { min: 1, max: 10 }
const coffeebreak = { min: 10, max: 60 }

const rwaypoint = new RandomWaypointModel(20, field_size, velocity, coffeebreak)

function loop(timestamp) {
    context.clearRect(0, 0, WIDTH, HEIGHT)
    rwaypoint.step(0.1)
    window.requestAnimationFrame((ts) => loop(ts))
}

window.requestAnimationFrame((ts) => loop(ts))
