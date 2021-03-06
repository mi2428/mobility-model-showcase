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
const distance = (v1, v2) => l2norm({x: v1.x - v2.x, y: v1.y - v2.y});
const rand = (min, max) => Math.random() * (max - min) + min;
const randvec = (x_min, x_max, y_min, y_max) => new Vector2(rand(x_min, x_max), rand(y_min, y_max));

const RT = {
    CoffeebreakIsOver: 1,
    Arrived: 2
};

class Node {
    constructor(pos, speed, dest) {
        this.pos = pos;
        this.neighbors = [];
        this.setJourney(speed, dest);
        this.allowable_error = 1;
    }

    addNeighbor(n) {
        this.neighbors.push(n);
    }

    clearNeighbors() {
        this.neighbors = [];
    }

    setVelocity(speed) {
        this.speed = speed;
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
        this.model = MODEL.RandomWaypointModel.id;
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
        this.field_size = params.field_size;
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

class RPGMModel {
    constructor(params) {
        this.model = MODEL.RPGMModel.id;
        this.nodes = [];
        this.reset(params);
        this.dt = 0.1;
    }

    _rand_rp_spd = () => rand(this.speed_limit.min, this.speed_limit.max);
    _rand_rp_loc = () => randvec(this.group_radius, this.field_size.x - this.group_radius,
                                 this.group_radius, this.field_size.y - this.group_radius);
    _rand_rp_brk = () => rand(this.coffeebreak_limit.min, this.coffeebreak_limit.max);
    _rand_pt_loc = (rp_loc) => {
        const dist = rand(0, this.group_radius);
        const theta = rand(0, 360) * Math.PI / 180;
        return new Vector2(rp_loc.x + dist * Math.cos(theta), rp_loc.y + dist * Math.sin(theta));
    };

    _autoscale() {
        while (this.nodes.length < this.n_nodes) {
            const pos = this._rand_pt_loc(this.rp.pos);
            const dest = this._rand_pt_loc(this.rp.dest);
            const speed = distance(pos, dest) * this.rp.speed / distance(this.rp.pos, this.rp.dest);
            const node = new Node(pos, speed, dest);
            this.nodes.push(node);
        }
        while (this.nodes.length > this.n_nodes) {
            delete this.nodes.pop();
        }
    }

    _set_new_journey() {
        const next_rp_loc = this._rand_rp_loc();
        const next_rp_spd = this._rand_rp_spd();
        const req_time = distance(this.rp.dest, next_rp_loc) / next_rp_spd;
        for (var node of this.nodes) {
            const next_node_loc = this._rand_pt_loc(next_rp_loc);
            const next_node_spd = distance(node.pos, next_node_loc) / req_time;
            node.setJourney(next_node_spd, next_node_loc);
        }
        this.rp.setJourney(next_rp_spd, next_rp_loc);
    }

    _update() {
        switch (this.rp.move(this.dt)) {
            case RT.CoffeebreakIsOver:
                this._set_new_journey();
                break;
            case RT.Arrived:
                this.rp.coffeebreak = this._rand_rp_brk();
                break;
        }
        if (this.rp.coffeebreak == 0) {
            for (var node of this.nodes) node.move(this.dt);
        }
    }

    reset(params) {
        this.field_size = params.field_size;
        this.coffeebreak_limit = params.coffeebreak_limit;
        this.group_radius = params.group_radius;

        if (this.speed_limit === undefined) {
            this.speed_limit = params.speed_limit;
        }

        if (this.rp === undefined) {
            this.rp = new Node(this._rand_rp_loc(), this._rand_rp_spd(), this._rand_rp_loc());
        }

        if (this.speed_limit != params.speed_limit) {
            this.speed_limit = params.speed_limit;
            this.rp.setVelocity(this._rand_rp_spd());
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
    RandomWaypointModel: { id: 1, name: "Random Waypoint" },
    RPGMModel: { id: 2, name: "Reference Point Group Mobility" },
}

const NewClusterDefine = (cid, field_width, field_height, field_scale) => {
    const color = '#' + ( 0x1000000 + Math.random() * 0xffffff ).toString(16).substr(1,6);
    const cdef = {
        id: cid,
        model: MODEL.RandomWaypointModel.id,
        numOfNodes: 30,
        groupRadius: 100,
        speedMax: 10,
        speedMin: 1,
        coffeebreakMax: 10,
        coffeebreakMin: 1,
        radiusStable: 100,
        radiusUnstable: 130,
        visible: true,
        drawEdges: false,
        superNode: false,
        nodeSize: 13,
        edgeWidth: 2,
        color: color,
        fieldWidth: field_width,
        fieldHeight: field_height,
        fieldScale: field_scale,
        chartCanvasId: "", 
    };
    return cdef;
};

const GetModelParams = (cdef) => {
    switch (cdef.model) {
        case MODEL.RandomWaypointModel.id:
            return {
                n_nodes: cdef.numOfNodes,
                field_size: { x: cdef.fieldWidth * cdef.fieldScale, y: cdef.fieldHeight * cdef.fieldScale },
                speed_limit: { min: cdef.speedMin * cdef.fieldScale, max: cdef.speedMax * cdef.fieldScale },
                coffeebreak_limit: { min: cdef.coffeebreakMin, max: cdef.coffeebreakMax }
            };
        case MODEL.RPGMModel.id:
            return {
                n_nodes: cdef.numOfNodes,
                group_radius: cdef.groupRadius,
                field_size: { x: cdef.fieldWidth * cdef.fieldScale, y: cdef.fieldHeight * cdef.fieldScale },
                speed_limit: { min: cdef.speedMin * cdef.fieldScale, max: cdef.speedMax * cdef.fieldScale },
                coffeebreak_limit: { min: cdef.coffeebreakMin, max: cdef.coffeebreakMax }
            };
    }
};

const NewClusterInstance = (cdef) => {
    switch (cdef.model) {
        case MODEL.RandomWaypointModel.id:
            return new RandomWaypointModel(GetModelParams(cdef));
        case MODEL.RPGMModel.id:
            return new RPGMModel(GetModelParams(cdef));
    }
};

var ClusterInstances = {};
var ChartInstances = {};

const ControlPanel = new Vue({
    el: '#control-panel',
    data: {
        clusterDefines: [],
        nextId: 1,
        models: MODEL,
        fieldWidth: 1000,
        fieldHeight: 1000,
        fieldScale: 1.0,
        currentTime: "0.0",
        datasets: [],
    },
    watch: {
        clusterDefines: {
            handler: function() {
                var cdefids = []
                for (var cdef of this.clusterDefines) {
                    if (!(cdef.id in ClusterInstances)) ClusterInstances[cdef.id] = NewClusterInstance(cdef);
                    cdefids.push(cdef.id);
                }
                if (cdefids.length == 0) {
                    $(".control-panel").addClass("op-1");
                    $(".field-size-control").prop("disabled", false);
                }
                if (cdefids.length > 0) {
                    $(".control-panel").removeClass("op-1");
                    $(".field-size-control").prop("disabled", true);
                }
                for (var cid of Object.keys(ClusterInstances)) {
                    if (!cdefids.includes(Number(cid))) {
                        delete ClusterInstances[cid];
                        this.datasets = this.datasets.filter(d => d.id != cid);
                    }
                }
                for (var cdef of this.clusterDefines) {
                    const cluster = ClusterInstances[cdef.id];
                    if (cluster.model == cdef.model) cluster.reset(GetModelParams(cdef));
                    else ClusterInstances[cdef.id] = NewClusterInstance(cdef);
                }
            },
            deep: true
        },
        datasets: {
            handler: function() {
                var dsetids = []
                for (var didx = 0; didx < this.datasets.length; didx++) {
                    const dset = this.datasets[didx];
                    dsetids.push(dset.id);
                    if (!(dset.id in ChartInstances)) {
                        const chartid = 'chart-' + dset.id;
                        const parent = $('#chart-holder');
                        const me = $('<div></div>').attr('id', chartid).addClass('card');
                        const mycardheader = $('<div></div>').addClass('chart-header').addClass('bg-transparent');
                        const myheader = $('<h1>Average degree of Cluster #' + dset.id + '</h1>').addClass('sf');
                        const mycardbody = $('<div></div>').addClass('card-body');
                        const mycanvas = $('<canvas></canvas>').attr('id', chartid + '-canvas').addClass('chart-canvas');
                        mycardheader.append(myheader);
                        mycardbody.append(mycanvas);
                        me.append(mycardheader).append(mycardbody);
                        if (parent.children().length == 0) {
                            parent.append(me);
                        } else {
                            const siblings = parent.children();
                            for (var i = 0; i < siblings.length; i++) {
                                const sibling = siblings[i];
                                const siblingid = Number($(sibling).attr('id').slice(6));
                                if (dset.id > siblingid && i < siblings.length - 1) continue ;
                                if (dset.id < siblingid) $(sibling).before(me);
                                else $(sibling).after(me);
                                break
                            }
                        }
                        ChartInstances[dset.id] = chartid;
                        this.chartDrawing(chartid + '-canvas', didx);
                    }
                }
                for (var dsetid  of Object.keys(ChartInstances)) {
                    if (!dsetids.includes(Number(dsetid))) {
                        const chartid = 'chart-' + dsetid;
                        $('#' + chartid).remove();
                        delete ChartInstances[dsetid];
                    }
                }
            },
            deep: true
        }
    },
    methods: {
        addCluster: function() {
            this.clusterDefines.push(NewClusterDefine(this.nextId++, this.fieldWidth, this.fieldHeight, this.fieldScale));
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
        showChart: function(chartid) {
            $('#chart-' + chartid).removeClass('d-none');
        },
        hideChart: function(chartid) {
            $('#chart-' + chartid).addClass('d-none');
        },
        chartDrawing: function(eid, didx) {
            const canvas = document.getElementById(eid);
            const context = canvas.getContext("2d");
            const onRefresh = (chart) => {
                if (chart.data.datasets[0] === undefined) {
                    chart.data.datasets.push({
                        id: ControlPanel.datasets[didx].id,
                        label: ControlPanel.datasets[didx].label,
                        borderColor: ControlPanel.datasets[didx].color,
                        fill: false,
                        cubicInterpolationMode: 'monotone',
                        data: []
                    });
                }
                chart.data.datasets[0].data.push({
                    x: Date.now(),
                    y: ControlPanel.datasets[didx].data.pop()
                });
            };
            const chart = new Chart(context, {
                type: 'line',
                data: { datasets: [{
                    borderWidth: 1,
                    pointRadius: 2,
                    borderColor: '#212529',
                    pointColor: '#212529',
                    data: [] 
                }] },
                options: {
                    responsive: false,
                    maintainAspectRatio: false,
                    animation: {
                        duration: 0
                    },
                    hover: {
                        animationDuration: 0
                    },
                    responsiveAnimationDuration: 0,
                    legend: { display: false },
                    title: { display: false },
                    scales: {
                        xAxes: [{
                            display: false,
                            type: 'realtime',
                            realtime: {
                                onRefresh: onRefresh
                            }
                        }]
                    }
                }
            });
        },
        showcaseDrawing: function() {
            const delta = 0.1;
            const canvas = document.getElementById('showcase');
            const canvas_wrapper = document.getElementById('showcase-wrapper');
            const context = canvas.getContext("2d");

            const edges = (nodes, radius_s, radius_u) => {
                var e = [], ee = [];
                for (var i = 0; i < nodes.length - 1; i++) {
                    const p1 = nodes[i].pos;
                    for (var j = i + 1; j < nodes.length; j++) {
                        const p2 = nodes[j].pos;
                        const d = distance(p1, p2);
                        if (d <= radius_u) ee.push([[p1.x, p1.y], [p2.x, p2.y]]);
                        if (d <= radius_s) {
                            e.push([[p1.x, p1.y], [p2.x, p2.y]]);
                            nodes[i].addNeighbor(j);
                            nodes[j].addNeighbor(i);
                        }
                    }
                }
                return [e, ee];
            };

            const sup_edges = (sup_nodes, all_nodes, radius_s, radius_u) => {
                var e = [], ee = [];
                for (var i = 0; i < sup_nodes.length; i++) {
                    const n1 = sup_nodes[i];
                    const p1 = n1.pos;
                    for (var cluster_nodes of all_nodes) {
                        for (var j = 0; j < cluster_nodes.length; j++) {
                            const n2 = cluster_nodes[j];
                            const p2 = n2.pos;
                            const d = distance(p1, p2);
                            if (d == 0) continue;
                            if (d <= radius_u) ee.push([[p1.x, p1.y], [p2.x, p2.y]]);
                            if (d <= radius_s) {
                                e.push([[p1.x, p1.y], [p2.x, p2.y]]);
                                n1.addNeighbor(j);
                                n2.addNeighbor(i);
                            }
                        }
                    }
                }
                return [e, ee];
            };

            const degrees = (nodes) => {
                var sum = 0, min = 0, max = 0;
                for (var i = 0; i < nodes.length - 1; i++) {
                    for (var j = i; j < nodes.length; j++) {
                        const d = nodes[i].neighbors.length;
                        if (d < min) min = d;
                        if (d > max) max = d;
                        sum += d;
                    }
                }
                const ave = 2 * sum / ( nodes.length * (nodes.length - 1));
                return {min: min, max: max, ave: ave};
            }

            const updateDatasets = (cluster, cdef) => {
                const buffersize = 50;
                const data = {
                    x: Date.now(),
                    y: degrees(cluster.nodes).ave
                };
                for (var dataset of this.datasets) {
                    if (dataset.id != cdef.id) continue ;
                    if (dataset.data.length >= buffersize) dataset.data.pop();
                    dataset.data.push(data);
                    return;
                }
                this.datasets.push({
                    id: cdef.id,
                    label: 'Cluster #' + cdef.id,
                    borderColor: cdef.color,
                    fill: false,
                    cubicInterpolationMode: 'monotone',
                    data: [ data ]
                })
            };

            const updateCanvasSize = () => {
                canvas_wrapper.width = $(window).width();
                canvas_wrapper.height = $(window).height();
                canvas.width = this.fieldWidth * this.fieldScale;
                canvas.height = this.fieldHeight * this.fieldScale;

                if (canvas.width < canvas_wrapper.width) {
                    const p = Math.floor((canvas_wrapper.width - canvas.width - 2) / 2);
                    $(canvas).css({'margin-left': p + 'px', 'margin-right': p + 'px'});
                }

                if (canvas.height < canvas_wrapper.height) {
                    const p = Math.floor((canvas_wrapper.height - canvas.height - 2 - 6) / 2);
                    $(canvas).css({'margin-top': p + 'px', 'margin-bottom': p + 'px'});
                }
            };

            const loop = (timestamp) => {
                var sup_clusters = [];
                var all_nodes = [];
                var draw_buf = [];

                const draw_nodes = (cluster, cdef) => {
                    if (!cdef.visible) return ;
                    const nodes = cluster.nodes;
                    for (var node of nodes) {
                        context.beginPath();
                        context.fillStyle = cdef.color;
                        context.arc(node.pos.x, node.pos.y, cdef.nodeSize / 2, 0, 2 * Math.PI);
                        context.fill();
                    }
                };

                const draw_edges = (cluster, cdef) => {
                    const nodes = cluster.nodes;
                    const radius_s = cdef.radiusStable * cdef.fieldScale;
                    const radius_u = cdef.radiusUnstable * cdef.fieldScale;
                    if (!cdef.drawEdges) {
                        this.hideChart(cdef.id);
                        return;
                    }
                    this.showChart(cdef.id);
                    var edges_all = []
                    if (cdef.superNode) edges_all = sup_edges(nodes, all_nodes, radius_s, radius_u);
                    else edges_all = edges(nodes, radius_s, radius_u);
                    updateDatasets(cluster, cdef);
                    if (!cdef.visible) return ;
                    context.setLineDash([]);
                    for (var edge of edges_all) {
                        for (var e of edge) {
                            const x1 = e[0][0], y1 = e[0][1], x2 = e[1][0], y2 = e[1][1];
                            context.beginPath();
                            context.moveTo(x1, y1);
                            context.lineTo(x2, y2);
                            context.strokeStyle = cdef.color;
                            context.lineWidth = cdef.edgeWidth;
                            context.stroke();
                        }
                        context.setLineDash([1, 4]);
                    }
                };

                const draw = () => {
                    context.clearRect(0, 0, canvas.width, canvas.height);
                    if (draw_buf.length == 0) return ;
                    const drawers = [draw_edges, draw_nodes];
                    for (var drawer of drawers) {
                        for (var req of draw_buf) {
                            const cluster = req[0], cdef = req[1];
                            drawer(cluster, cdef);
                        }
                    }
                    this.currentTime = (Number(this.currentTime) + delta).toFixed(1);
                    draw_buf = [];
                };

                for (var cid of Object.keys(ClusterInstances)) {
                    const cdef = this.getCluster(cid);
                    const cluster = ClusterInstances[cid];
                    const nodes = cluster.step(delta);
                    for (var node of nodes) node.clearNeighbors();
                    all_nodes.push(nodes);
                    if (cdef.superNode) sup_clusters.push([cluster, cdef]);
                    else draw_buf.push([cluster, cdef]);
                }

                for (var sup_cluster of sup_clusters) {
                    const cluster = sup_cluster[0], cdef = sup_cluster[1];
                    draw_buf.push([cluster, cdef]);
                }

                updateCanvasSize();
                draw();
                requestAnimationFrame((ts) => loop(ts));
            };

            requestAnimationFrame((ts) => loop(ts));
        }
    },
    mounted: function() {
        this.fieldWidth = Math.round($(window).width() * 0.9);
        this.fieldHeight = Math.round($(window).height() * 0.9);

        if (this.fieldHeight < this.fieldWidth) this.fieldWidth = this.fieldHeight;
        if (this.fieldWidth < this.fieldHeight) this.fieldHeight = this.fieldWidth;

        this.showcaseDrawing();
    }
});
