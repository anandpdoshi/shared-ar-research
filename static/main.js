var markers = {
    '001.patt': {
        box_color: "#F98866",
        knot_color: "#FF420E"
    },
    '002.patt': {
        box_color: "#80BD9E",
        knot_color: "#89DA59"
    },
    '003.patt': {
        box_color: "#90AFC5",
        knot_color: "#336B87"
    },
    '004.patt': {
        // model: 'Red-Lamborghini',
        image: 'hokusai-great-wave.jpg',
        box_color: "#2A3132",
        knot_color: "#763626"
    }
};

var markers_list = Object.keys(markers);

var sharedAR = {
    init_renderer: function(canvas_id) {
        // Init WebGL Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById(canvas_id),
            antialias: true,
            alpha: true
        });

        this.renderer.setClearColor(new THREE.Color('lightgrey'), 0);

        // canvas size and pixel ratio
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        this.on_render_functions = [];
    },

    init_scene: function() {
        this.scene = new THREE.Scene();

        var ambient = new THREE.AmbientLight( 0x666666 );
    	this.scene.add( ambient );

    	var directionalLight = new THREE.DirectionalLight( 0x887766 );
    	directionalLight.position.set( -1, 1, 1 ).normalize();
    	this.scene.add( directionalLight );
    },

    init_camera: function() {
        this.camera = new THREE.Camera();
        // this.camera = new THREE.PerspectiveCamera( 45, window.innerWidth, window.innerHeight, 1, 1000 );
        // this.camera = new THREE.PerspectiveCamera(42, this.renderer.domElement.width / this.renderer.domElement.height, 0.01, 100);
        this.scene.add(this.camera);
    },

    init_source: function() {
        var me = this;

        this.source = new THREEx.ArToolkitSource({
            sourceType: 'webcam'
        });

        this.source.init(function onReady() {
            me.on_resize();
        });

        window.addEventListener('resize', function() {
            me.on_resize();
        });
    },

    on_resize: function() {
        // canvas size and pixel ratio
        this.source.onResizeElement();
        this.source.copyElementSizeTo(this.renderer.domElement);
        if (this.context.arController != null) {
            this.source.copyElementSizeTo(this.context.arController.canvas);
        }

    },

    init_context: function() {
        var me = this;

        this.context = new THREEx.ArToolkitContext({
            cameraParametersUrl: '/data/camera_para.dat',
            detectionMode: 'mono',

            // resolution of at which we detect pose in the source image
        	// canvasWidth: 640,
        	// canvasHeight: 480,
            // maxDetectionRate: 60,

            // imageSmoothingEnabled : true,
        });

        this.context.init(function onCompleted() {
            // copy projection matrix to camera
            // NOTE why is this necessary?
            me.camera.projectionMatrix.copy( me.context.getProjectionMatrix() );
        });

        this.on_render_functions.push(function() {
            if (me.source.ready == false) return;

            me.context.update(me.source.domElement);

            // me.ar_world_group.visible = me.camera.visible;
        });
    },

    init_marker: function() {
        this.marker_groups = [];
        var marker_group, patternUrl;

        for ( var i=0, j=markers_list.length; i < j; i++ ) {
            patternUrl = '/data/' + markers_list[i];
            this.new_marker(patternUrl);
        }
    },

    new_marker: function(patternUrl) {
        // console.log('new_marker', patternUrl);
        marker_group = new THREE.Group;  // v/s new THREE.Group
        this.scene.add(marker_group);
        this.marker_groups.push(marker_group);

        new THREEx.ArMarkerControls(this.context, marker_group, {
            type: 'pattern',
            patternUrl: patternUrl,

            // as we control the camera, set changeMatrixMode: 'cameraTransformMatrix'
            // changeMatrixMode: 'cameraTransformMatrix'
        });
    },

    init_smoothed_controls: function() {
        var me = this;
        this.smoothed_controls = [];
        this.smoothed_groups = [];

        console.log('init_smoothed_controls', markers_list);
        for (var i=0, j=markers_list.length; i < j; i++) {
            this.new_smoothed_marker();
        }

        this.on_render_functions.push(function() {
            for (var i=0, j=markers_list.length; i < j; i++) {
                me.smoothed_controls[i].update(me.marker_groups[i])
            }
            // me.smoothed_controls.update(me.marker_group);
        });
    },

    new_smoothed_marker: function() {
        // console.log('new_smoothed_marker');
        // build a smoothedControl
        // NOTE I think this is to smoothly move the marker
        var smoothed_group = new THREE.Group();
        this.scene.add(smoothed_group);

        var smoothed_controls = new THREEx.ArSmoothedControls(smoothed_group, {
            lerpPosition: 0.4,
            lerpQuaternion: 0.3,
            lerpScale: 1,
            // minVisibleDelay: 1,
    		// minUnvisibleDelay: 1
        });

        smoothed_controls.addEventListener('becameVisible', function(){
    		console.log('becameVisible event notified');
            // console.log(this);
    	});

    	smoothed_controls.addEventListener('becameUnVisible', function(){
    		console.log('becameUnVisible event notified');
    	});

        this.smoothed_groups.push(smoothed_group);
        this.smoothed_controls.push(smoothed_controls);
        // return smoothed_controls;
    },

    init_object: function(obj) {
        // instead of a new scene, we use the smoothed group to add objects to
        // this.marker_scene = new THREE.Scene();
        // this.marker_group.add(this.marker_scene);

        var ar_obj_group = new THREE.Group();

        if (obj.model) {
            var loader = new THREE.ObjectLoader();
            loader.load('/static/models/' + obj.model + '/model.json', function ( obj ) {
                 ar_obj_group.add( obj );
            });
            // var loader = new THREE.JSONLoader();
            // loader.load( , function ( geometry, materials ) {
            //     var mesh = new THREE.Mesh( geometry, new THREE.MeshFaceMaterial( materials ) );
            //     ar_obj_group.add( mesh );
            // });
        } else if (obj.image) {
            var geometry = new THREE.PlaneGeometry( 0.8, 0.8 ).rotateX( -Math.PI/2 );
            var texture = new THREE.TextureLoader().load('/static/images/' + obj.image, function(t) {
                var img = t.image;
                var min_val = Math.min(img.width, img.height);
                var width = 6 * img.width / min_val;
                var height = 6 * img.height / min_val;
                // console.log(img, width, height);
                mesh.scale.set(width, 0, height);
                // console.log(t.image.width);
            });
            console.log(texture);
    		var material = new THREE.MeshBasicMaterial({
    			side: THREE.DoubleSide,
    			map: texture,
    			alphaTest: 0.9,
    		});
    		var mesh = new THREE.Mesh( geometry, material );

            // mesh.position.y = -screenDepth;
            ar_obj_group.add(mesh);

        } else {
            var axis_helper_mesh = new THREE.AxisHelper();
            ar_obj_group.add(axis_helper_mesh);

            // add a torus knot
            var cube_mesh = this.get_cube_mesh(obj);
            ar_obj_group.add(cube_mesh);

            var torus_knot_mesh = this.get_torus_knot_mesh(obj);
            ar_obj_group.add(torus_knot_mesh);

            this.on_render_functions.push(function(delta) {
                torus_knot_mesh.rotation.x += delta * Math.PI;
            });
        }

        return ar_obj_group;
    },

    get_cube_mesh: function(obj) {
        var color = obj['box_color'];
        var geometry = new THREE.BoxGeometry(1, 1, 1);
        // var material = new THREE.MeshNormalMaterial({
        //     transparent: true,
        //     opacity: 0.5,
        //     side: THREE.DoubleSide
        // });
        var material = new THREE.MeshLambertMaterial({
            color: new THREE.Color(color || 0x000033),
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        var mesh = new THREE.Mesh( geometry, material );
        mesh.position.y = geometry.parameters.height / 2;
        return mesh;
    },

    get_torus_knot_mesh: function(obj) {
        var color = obj['knot_color'];
        var geometry = new THREE.TorusKnotGeometry(0.3, 0.1, 64, 16);
        // var material = new THREE.MeshNormalMaterial();
        var material = new THREE.MeshLambertMaterial({
            color: new THREE.Color(color || 0x770000)
        });
        var mesh = new THREE.Mesh( geometry, material );
        mesh.position.y = 0.5;
        return mesh;
    },

    assign_objects: function(now) {
        // this.objects = shuffle(this.objects);
        for ( var i=0, j=this.smoothed_groups.length; i < j; i++ ) {
            var smoothed_group = this.smoothed_groups[i];
            var obj = this.objects[i];
            var prev_obj = this.group_object_map[smoothed_group.uuid];
            if (prev_obj) {
                smoothed_group.remove(prev_obj);
            }
            smoothed_group.add(obj);
            this.group_object_map[smoothed_group.uuid] = obj;

            if (smoothed_group.visible) {
                console.log(i, smoothed_group.position, smoothed_group.rotation);
            }
        }

        this.previous_change = now;
    },

    render: function() {
        var me = this;
        sharedAR.init_renderer('ar-canvas');
        sharedAR.init_scene();
        sharedAR.init_camera();
        sharedAR.init_source();
        sharedAR.init_context();
        sharedAR.init_marker();
        sharedAR.init_smoothed_controls();

        sharedAR.objects = [];
        var object_list = Object.values(markers);
        for (var i=0, j=object_list.length; i < j; i++) {
            sharedAR.objects.push(sharedAR.init_object(object_list[i]));
        }

        sharedAR.group_object_map = {};
        // sharedAR.object_group_map = {};

        sharedAR.on_render_functions.push(function(delta, now) {
            if ( !sharedAR.previous_change ) {
                sharedAR.previous_change = now;
                sharedAR.assign_objects(now);

            } else if ( now - sharedAR.previous_change > 5 ) {
                sharedAR.assign_objects(now);
            }
        });

        sharedAR.on_render_functions.push(function(){
    		sharedAR.renderer.render( sharedAR.scene, sharedAR.camera );
    		// stats.update();
    	});

        // run the render loop
        var prev_ms = null;
        requestAnimationFrame(function animate(now_ms) {
            // keep looping
            requestAnimationFrame( animate );

            // measure time
            prev_ms = prev_ms || now_ms - 1000 / 60;
            var delta_ms = Math.min(200, now_ms - prev_ms);
            prev_ms = now_ms;

            // call each update function
            me.on_render_functions.forEach(function(on_render_fn) {
                on_render_fn(delta_ms / 1000, now_ms / 1000);
            });
        });

    },
};

sharedAR.render();

function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}
