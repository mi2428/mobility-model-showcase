'use strict';

class Vector2 {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    add = (v) => new Vector2(this.x + v.x, this.y + v.y);
    sub = (v) => new Vector2(this.x - v.x, this.y - v.y);
    scalar = (a) => new Vector2(this.x * a, this.y * a);
};

const l2norm = (v) => Math.sqrt(v.x ** 2 + v.y ** 2);
const distance = (v1, v2) => l2norm(v2.sub(v1));
const rand = (min, max) => Math.random() * (max - min) + min;
const randvec = (x_min, x_max, y_min, y_max) => new Vector2(rand(x_min, x_max), rand(y_min, y_max));

const RT = {
    CoffeebreakIsOver: 1,
    Arrived: 2
};

class Node {
    constructor(pos, speed, dest) {
        this.pos = pos;
        this.setJourney(speed, dest);
        this.allowable_error = 1;
    }

    setVelocity(speed) {
        this.velocity = this.dest.sub(this.pos).scalar(speed / distance(this.pos, this.dest));
    }

    setJourney(speed, dest) {
        this.dest = dest;
        this.setVelocity(speed);
        this.coffeebreak = 0;
    }

    move(dt) {
        if (this.coffeebreak > 0) {
            this.coffeebreak -= dt;
            if (this.coffeebreak <= 0) return RT.CoffeebreakIsOver;
            return 0;
        }
        this.pos = this.pos.add(this.velocity.scalar(dt));
        if (distance(this.pos, this.dest) <= this.allowable_error) return RT.Arrived;
        return 0;
    }
}

class RandomWaypointModel {
    constructor(params) {
        this.field_size = params.field_size;
        this.nodes = [];
        this.reset(params);
        this.dt = 0.1;
    }

    _randspd = () => rand(this.speed_limit.min, this.speed_limit.max);
    _randloc = () => randvec(0, this.field_size.x, 0, this.field_size.y);
    _randbrk = () => rand(this.coffeebreak_limit.min, this.coffeebreak_limit.max);

    _autoscale() {
        while (this.nodes.length < this.n_nodes) {
            const node = new Node(this._randloc(), this._randspd(), this._randloc());
            this.nodes.push(node);
        }
        while (this.nodes.length > this.n_nodes) {
            delete this.nodes.pop();
        }
    }

    _update() {
        for (var node of this.nodes) {
            switch (node.move(this.dt)) {
                case RT.CoffeebreakIsOver:
                    node.setJourney(this._randspd(), this._randloc());
                    break;
                case RT.Arrived:
                    node.coffeebreak = this._randbrk();
                    break;
            }
        }
    }

    reset(params) {
        this.coffeebreak_limit = params.coffeebreak_limit;

        if (this.speed_limit != params.speed_limit) {
            this.speed_limit = params.speed_limit;
            for (var node of this.nodes) node.setVelocity(this._randspd());
        }

        if (this.n_nodes != params.n_nodes) {
            this.n_nodes = params.n_nodes;
            this._autoscale();
        }
    }

    step(delta) {
        var c = 0;
        while (c * this.dt <= delta) {
            this._update();
            c += 1;
        }
        return this.nodes;
    }
}

const MODEL = {
    RandomWaypointModel: 1,
    RPGMModel: 2
}

const NewClusterDefine = (cid) => {
    const color = '#' + ( 0x1000000 + Math.random() * 0xffffff ).toString(16).substr(1,6);
    const cluster = {
        id: cid,
        model: MODEL.RandomWaypointModel,
        numOfNodes: 30,
        speedMax: 10,
        speedMin: 1,
        coffeebreakMax: 10,
        coffeebreakMin: 1,
        radius: 100,
        visible: true,
        drawEdges: false,
        superNode: false,
        nodeSize: 13,
        edgeWidth: 9,
        color: color
    };
    return cluster;
};

const GetModelParams = (cdef) => {
    switch (cdef.model) {
        case MODEL.RandomWaypointModel:
            return {
                n_nodes: cdef.numOfNodes,
                field_size: { x: WIDTH, y: HEIGHT },
                speed_limit: { min: cdef.speedMin, max: cdef.speedMax },
                coffeebreak_limit: { min: cdef.coffeebreakMin, max: cdef.coffeebreakMax }
            };
        case MODEL.RPGMModel:
            return ;
    }
};

const NewClusterInstance = (cdef) => {
    switch (cdef.model) {
        case MODEL.RandomWaypointModel:
            return new RandomWaypointModel(GetModelParams(cdef));
        case MODEL.RPGMModel:
            return ;
    }
};

var ClusterInstances = {};

const WIDTH = 1000
const HEIGHT = 1000

const ControlPanel = new Vue({
    el: '#control-panel',
    data: {
        clusterDefines: [],
        nextId: 1,
    },
    watch: {
        clusterDefines: {
            handler: function() {
                var cdefids = []
                for (var cdef of this.clusterDefines) {
                    if (!(cdef.id in ClusterInstances)) ClusterInstances[cdef.id] = NewClusterInstance(cdef);
                    cdefids.push(cdef.id);
                }
                for (var cid of Object.keys(ClusterInstances)) {
                    if (!cdefids.includes(Number(cid))) delete ClusterInstances[cid];
                }
                for (var cdef of this.clusterDefines) {
                    const cluster = ClusterInstances[cdef.id];
                    cluster.reset(GetModelParams(cdef));
                }
            },
            deep: true
        }
    },
    methods: {
        addCluster: function() {
            this.clusterDefines.push(NewClusterDefine(this.nextId++));
        },
        getCluster: function(cid) {
            for (var cdef of this.clusterDefines)
                if (cdef.id == cid) return cdef;
            return undefined;
        },
        deleteCluster: function(event) {
            const targetid = event.target.dataset.cid;
            this.clusterDefines = this.clusterDefines.filter(c => c.id != targetid);
        },
    },
});


const delta = 0.1;
const canvas = document.getElementById('canvas');
const context = canvas.getContext("2d");

const draw = (timestamp) => {
    // canvas.height = window.innerHeight;
    // canvas.width = window.innerWidth;
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);

    if (Object.keys(ClusterInstances).length == 0) {
        const text = "Mobility Model Showcase";
        const fontsize = "32px"
        const textwidth = context.measureText(text).width;
        context.font = fontsize + " monospace";
        context.fillText(text, Math.round((canvas.width - textwidth) / 2), Math.round((canvas.height - fontsize) / 2));
        requestAnimationFrame((ts) => draw(ts));
    }

    for (var cid of Object.keys(ClusterInstances)) {
        const cluster = ClusterInstances[cid];
        const cdef = ControlPanel.getCluster(cid);
        const nodes = cluster.step(delta);
        for (var node of nodes) {
            context.beginPath();
            context.fillStyle = cdef.color;
            context.arc(node.pos.x, node.pos.y, cdef.nodeSize / 2, 0, 2 * Math.PI);
            context.fill();
        }
        requestAnimationFrame((ts) => draw(ts));
    }
};
requestAnimationFrame((ts) => draw(ts));