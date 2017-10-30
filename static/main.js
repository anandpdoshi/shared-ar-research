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
    visible_objects: 0,
    loaded_objects: {},

    init_renderer: function(canvas_id) {
        var me = this;

        // Init WebGL Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById(canvas_id),
            antialias: true,
            alpha: true
        });

        // this.renderer.setClearColor(new THREE.Color('lightgrey'), 0);

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
        // this.camera = new THREE.PerspectiveCamera(70, this.renderer.domElement.width / this.renderer.domElement.height, 0.01, 10000);
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
            me.on_resize(true);
        });
    },

    on_resize: function(resize) {
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
            cameraParametersUrl: '/static/data/camera_para.dat',
            detectionMode: 'mono_and_matrix',
            // detectionMode: 'color_and_matrix',

            // resolution of at which we detect pose in the source image
        	// canvasWidth: 640,
        	// canvasHeight: 480,
            maxDetectionRate: 30,

            imageSmoothingEnabled : true,
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
            patternUrl = '/static/data/' + markers_list[i];

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
        }
    },

    init_smoothed_controls: function() {
        var me = this;
        this.smoothed_controls = [];
        this.smoothed_groups = [];

        console.log('init_smoothed_controls', markers_list);
        for (var i=0, j=markers_list.length; i < j; i++) {
            this.new_smoothed_marker(markers_list[i]);
        }

        this.on_render_functions.push(function() {
            for (var i=0, j=markers_list.length; i < j; i++) {
                me.smoothed_controls[i].update(me.marker_groups[i])
            }
            // me.smoothed_controls.update(me.marker_group);
        });
    },

    new_smoothed_marker: function(marker_name) {
        // console.log('new_smoothed_marker');
        // build a smoothedControl
        // NOTE I think this is to smoothly move the marker
        var me = this;

        var smoothed_group = new THREE.Group();
        this.scene.add(smoothed_group);

        var smoothed_controls = new THREEx.ArSmoothedControls(smoothed_group, {
            lerpPosition: 0.4,
            lerpQuaternion: 0.3,
            lerpScale: 1,
            // minVisibleDelay: 1,
    		// minUnvisibleDelay: 1
        });

        smoothed_controls.marker_name = marker_name;
        smoothed_controls.smoothed_group = smoothed_group;

        smoothed_controls.addEventListener('becameVisible', function(){
    		console.log('becameVisible event notified');
            console.log('visible', this.object3d.children);

            // hide every settings panel
            $('.settings').addClass('hidden');

            var marker_id = this.marker_name.replace('.', '-');

            if (!$('#' + marker_id).length) {
                var marker_settings = $('#settings-template').clone();
                marker_settings.attr('id', marker_id);
                marker_settings.attr('data-marker', this.marker_name);
                marker_settings.find('.marker-name').text(this.marker_name);
                $('.all-settings').append(marker_settings);
            }

            // unhide current one
            $( '#' + marker_id ).removeClass('hidden').attr('data-state', 'visible');

            // me.visible_objects += 1;

            // TODO only show if 1 object in range
            // if (me.visible_objects) {
            //     document.querySelector( '#settings' ).classList.remove('hidden');
            // }

            z = 0;
            if (smoothed_controls.marker_name
                    && Object.keys(data[smoothed_controls.marker_name] || {}).length
                    && !smoothed_controls.smoothed_group.children.length
                ) {

                function load_layer_objects(layer_name) {
                    var obj_list = data[smoothed_controls.marker_name][layer_name];
                    for (var i=0, j=1 /*obj_list.length*/ ; i < j; i++) {
                        var obj_data = obj_list[i];
                        console.log(obj_data);
                        var id = obj_data['Content'];
                        if (!me.loaded_objects[id]) {
                            var obj_group = me.init_object(obj_data);
                            obj_group.obj_id = id;
                            me.loaded_objects[id] = obj_group;
                        }

                        var obj_group = me.loaded_objects[id];
                        obj_group.position.z = -1 * z;
                        obj_group.position.y = z;
                        // obj_group.position.x = z;
                        // obj_group.rotation.y = z;
                        smoothed_controls.smoothed_group.add(obj_group);
                        z -= 0.5;
                    }
                }

                if (data[smoothed_controls.marker_name]['Private']) {
                    load_layer_objects('Private');
                } else if (data[smoothed_controls.marker_name]['Public']) {
                    load_layer_objects('Public');
                }

            }

            console.log(this.marker_name);
    	});

    	smoothed_controls.addEventListener('becameUnVisible', function(){
    		console.log('becameUnVisible event notified');

            var marker_id = this.marker_name.replace('.', '-');
            $( '#' + marker_id ).attr('data-state', 'hidden');

            if (!$( '#' + marker_id ).find('.icon-div').hasClass('active')) {
                $( '#' + marker_id ).addClass('hidden');
            }

            // if (me.visible_objects > 0) {
            //     me.visible_objects -= 1;
            // }
            //
            // console.log(this);
            //
            // if (me.visible_objects == 0) {
            //     document.querySelector( '#settings' ).classList.add('hidden');
            // }
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
        } else if (obj.image || obj.uploaded) {
            var geometry = new THREE.PlaneGeometry( 0.8, 0.8 ).rotateX( -Math.PI/2 );
            var texture = new THREE.TextureLoader().load(obj.uploaded || ( '/static/images/' + obj.image ),
                function(t) {
                    var img = t.image;
                    var min_val = Math.min(img.width, img.height);
                    var width = 5 * img.width / min_val;
                    var height = 5 * img.height / min_val;
                    // console.log(img, width, height);
                    mesh.scale.set(width, 1, height);
                    // console.log(t.image.width);
                });
            // console.log(texture);
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

    // assign_objects: function(now) {
    //     // this.objects = shuffle(this.objects);
    //     for ( var i=0, j=this.smoothed_groups.length; i < j; i++ ) {
    //         var smoothed_group = this.smoothed_groups[i];
    //         var obj = this.objects[i];
    //         var prev_obj = this.group_object_map[smoothed_group.uuid];
    //         if (prev_obj) {
    //             smoothed_group.remove(prev_obj);
    //         }
    //         smoothed_group.add(obj);
    //         this.group_object_map[smoothed_group.uuid] = obj;
    //
    //         // if (smoothed_group.visible) {
    //         //     console.log(i, smoothed_group.position, smoothed_group.rotation);
    //         // }
    //     }
    //
    //     this.previous_change = now;
    // },

    render: function() {
        var me = this;
        sharedAR.init_renderer('ar-canvas');
        sharedAR.init_scene();
        sharedAR.init_camera();
        sharedAR.init_source();
        sharedAR.init_context();
        sharedAR.init_marker();
        sharedAR.init_smoothed_controls();

        // sharedAR.objects = [];
        // var object_list = Object.values(markers);
        // for (var i=0, j=object_list.length; i < j; i++) {
        //     sharedAR.objects.push(sharedAR.init_object(object_list[i]));
        // }
        //
        // sharedAR.group_object_map = {};
        // // sharedAR.object_group_map = {};
        //
        // sharedAR.on_render_functions.push(function(delta, now) {
        //     if ( !sharedAR.previous_change ) {
        //         sharedAR.previous_change = now;
        //         sharedAR.assign_objects(now);
        //
        //     } else if ( now - sharedAR.previous_change > 5 ) {
        //         sharedAR.assign_objects(now);
        //     }
        // });

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
};

document.addEventListener( "DOMContentLoaded", function( event ) {
    sharedAR.render();

    document.getElementById( 'layers' ).addEventListener( 'click', function( event ) {
        console.log(event);
    } );

    console.log('binding click');
    $('.all-settings').on('click', '.settings .icon-div', function( event ) {
        console.log('clicked settings icon');

        this.classList.toggle('active');

        var $settings = $(this).parent();
        console.log($settings.find('.settings-menu'));
        var menu = $settings
            .find('.settings-menu').toggleClass('hidden');

        if (!this.classList.contains('active') && $settings.attr('data-state')=='hidden') {
            $settings.addClass('hidden');
        }

        // document.querySelector( '.settings .settings-menu' ).classList.toggle('hidden');
    });

    $('.all-settings').on( 'change', '.settings .switch input',
        function( event ) {
            console.log(this.checked);
        } );

    $('.all-settings').on( 'touchend', '.upload form button[type="submit"]', function( event ) {
        $($(this).parents('form')[0]).trigger('submit');
        alert('touch!');
    });

    $('.all-settings').on( 'click', '.upload form button[name="upload"]', function( event, sdata ) {
        console.log(sdata);
        if ( sharedAR.active_marker ) {
            console.log( 'active marker', sharedAR.active_marker );
        }

        var $form = $($(this).parents("form")[0]);

        var marker_value = $($form.parents('.settings')[0]).attr('data-marker');
        $form.find('input[name="marker"]').val(marker_value);
        console.log(marker_value);
        // marker.value = marker_value;
        // console.log(marker, marker.name, marker.value);
        event.preventDefault();
        var data = new FormData($form.get(0));

        // var $form = $(this);
        // var data = $form.serialize();

        var public = $form.find('input[type="checkbox"]')[0].checked;
        console.log('public', public);
        data.append('public', public ? 1 : 0);
        // console.log(data, data.forEach(function() { console.log(arguments); }));


        $form.find('button').prop('disabled', true);

        // alert('clicked');

        $.ajax({
            url: '/upload',
            type: 'POST',
            data: data,
            enctype: 'multipart/form-data',
            processData: false,  // !important
            contentType: false,
            cache: false,
            success: function(d) {
                $form.find('button').attr('disabled', false);

                console.log(d);
                if (d.indexOf("{")===0) {
                    d = JSON.parse(d);
                    if (!window.data[d['Marker']]) {
                        window.data[d['Marker']] = {};
                    }
                    if (!window.data[d['Marker']][d['Layer']]) {
                        window.data[d['Marker']][d['Layer']] = [];
                    }
                    window.data[d['Marker']][d['Layer']].splice(0, 0, d);
                    window.data[d['Marker']][d['Layer']].join();
                }


            }
        });
        // return false;
    } );

} );


// TODO
// Show loading on a marker if objects not loaded
