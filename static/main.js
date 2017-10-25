var markers_list = ['001.patt', '002.patt', '003.patt', '004.patt'];

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
        console.log('new_marker', patternUrl);
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

        console.log('init_smoothed_controls', markers_list);
        for (var i=0, j=markers_list.length; i < j; i++) {
            var smoothed_controls = this.new_smoothed_marker();
            this.smoothed_controls.push(smoothed_controls);
        }

        this.on_render_functions.push(function() {
            for (var i=0, j=markers_list.length; i < j; i++) {
                me.smoothed_controls[i].update(me.marker_groups[i])
            }
            // me.smoothed_controls.update(me.marker_group);
        });
    },

    new_smoothed_marker: function() {
        console.log('new_smoothed_marker');
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
    		console.log('becameVisible event notified')
    	});

    	smoothed_controls.addEventListener('becameUnVisible', function(){
    		console.log('becameUnVisible event notified')
    	});

        this.init_object_at_marker(smoothed_group);

        return smoothed_controls;
    },

    init_object_at_marker: function(smoothed_group) {
        // instead of a new scene, we use the smoothed group to add objects to
        // this.marker_scene = new THREE.Scene();
        // this.marker_group.add(this.marker_scene);

        var ar_world_group = smoothed_group;

        var axis_helper_mesh = new THREE.AxisHelper();
        ar_world_group.add(axis_helper_mesh);

        // add a torus knot
        var cube_mesh = this.get_cube_mesh();
        ar_world_group.add(cube_mesh);

        var torus_knot_mesh = this.get_torus_knot_mesh();
        ar_world_group.add(torus_knot_mesh);

        this.on_render_functions.push(function(delta) {
            torus_knot_mesh.rotation.x += delta * Math.PI;
        });
    },

    get_cube_mesh: function() {
        var geometry = new THREE.CubeGeometry(1, 1, 1);
        var material = new THREE.MeshNormalMaterial({
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        var mesh = new THREE.Mesh( geometry, material );
        mesh.position.y = geometry.parameters.height / 2;
        return mesh;
    },

    get_torus_knot_mesh: function() {
        var geometry = new THREE.TorusKnotGeometry(0.3, 0.1, 64, 16);
        var material = new THREE.MeshNormalMaterial();
        var mesh = new THREE.Mesh( geometry, material );
        mesh.position.y = 0.5;
        return mesh;
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
        // sharedAR.init_object_at_marker();

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
