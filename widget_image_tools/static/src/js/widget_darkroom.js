/**
*    Copyright 2013 Matthieu Moquet
*    Copyright 2016-2017 LasLabs Inc.
*    Copyright 2017-2018 Artem Shurshilov
*    License MIT (https://opensource.org/licenses/MIT)
**/

odoo.define('web_widget_darkroom.darkroom_widget', function(require) {
    'use strict';

    var core = require('web.core');
    var qweb = core.qweb;
    //var common = require('web.form_common');
    var AbstractField = require('web.AbstractField');
    var widgetRegistry = require('web.widget_registry');
    var session = require('web.session');
    var utils = require('web.utils');
    //var QWeb = core.qweb;
    var QWeb = require('web.QWeb');
    var widgetRegistry = require('web.widget_registry');
    var field_registry = require('web.field_registry');
    var base_f = require('web.basic_fields');
    var field_utils = require('web.field_utils');
    var imageWidget = base_f.FieldBinaryImage;


    // overrie button "save" in modal darkromm for save only coords
    // cropCurrentZone and not real crop for further crop on server side
    var darkroomBut = null;
/*    form_widget.WidgetButton.include({
        on_click: function() {
            //if(this.node.attrs.id === "darkroom-save")
            //    darkroomBut.darkroom.plugins.crop.cropCurrentZone(true);
            this._super();
        },
    });*/

    var FieldDarkroomImage = imageWidget.extend({
        className: 'darkroom-widget',
        template: 'FieldDarkroomImage',
        placeholder: "/web/static/src/img/placeholder.png",
        darkroom: null,
        no_rerender: false,

        defaults: {
            // Canvas initialization size
            size: [800,600],
            minWidth: 100,
            minHeight: 100,
            maxWidth: 800,
            maxHeight: 600,
            ratio: null,
            backgroundColor: '#fff',

            // Plugin options
            // shursh mode
            plugins: {
                crop: {
                    minHeight: 50,
                    minWidth: 50,
                    maxHeight: 800,
                    maxWidth: 600,                    
                    ratio: null,
                },
            },
        },

        init: function (parent, name, record) {
            this._super.apply(this, arguments);
            console.log(this);
            this.nodeOptions = _.defaults(this.nodeOptions, this.defaults);
            this.fields = record.fields;
            this.useFileAPI = !!window.FileReader;
            this.max_upload_size = 25 * 1024 * 1024; // 25Mo
            if (!this.useFileAPI) {
                var self = this;
                this.fileupload_id = _.uniqueId('o_fileupload');
                $(window).on(this.fileupload_id, function () {
                    var args = [].slice.call(arguments).slice(1);
                    self.on_file_uploaded.apply(self, args);
                });
            }
        },

        _init_darkroom: function(activeModal) {
            if (!this.darkroom) {
                this._init_darkroom_icons();
                this._init_darkroom_ui();
                this._init_darkroom_plugins(activeModal);
                darkroomBut=this;
            }
        },

        _init_darkroom_icons: function() {
            var element = document.createElement('div');
            element.id = 'darkroom-icons';
            element.style.height = 0;
            element.style.width = 0;
            element.style.position = 'absolute';
            element.style.visibility = 'hidden';
            element.innerHTML = '<!-- inject:svg --><!-- endinject -->';
            this.el.appendChild(element);
        },

        _init_darkroom_plugins: function(activeModal) {
            //shursh mode by default
            var cropActive = false;
            var zoomActive = false;
            if (activeModal === 'crop')
                cropActive = true;
            if (activeModal === 'zoom')
                zoomActive = true;
            require('web_widget_darkroom.darkroom_crop').DarkroomPluginCrop(cropActive);
            require('web_widget_darkroom.darkroom_history').DarkroomPluginHistory();
            require('web_widget_darkroom.darkroom_rotate').DarkroomPluginRotate();
            require('web_widget_darkroom.darkroom_zoom').DarkroomPluginZoom(zoomActive);
        },

        _init_darkroom_ui: function() {
            // Button object
            function Button(element) {
                this.element = element;
            }

            Button.prototype = {
                addEventListener: function(eventName, listener) {
                    if (this.element.addEventListener) {
                        this.element.addEventListener(eventName, listener);
                    } else if (this.element.attachEvent) {
                        this.element.attachEvent('on' + eventName, listener);
                    }
                },
                removeEventListener: function(eventName, listener) {
                    if (this.element.removeEventListener) {
                        this.element.removeEventListener(eventName, listener);
                    } else if (this.element.detachEvent) {
                        this.element.detachEvent('on' + eventName, listener);
                    }
                },
                active: function(bool) {
                    if (bool) {
                        this.element.classList.add('darkroom-button-active');
                    } else {
                        this.element.classList.remove('darkroom-button-active');
                    }
                },
                hide: function(bool) {
                    if (bool) {
                        this.element.classList.add('hidden');
                    } else {
                        this.element.classList.remove('hidden');
                    }
                },
                disable: function(bool) {
                    this.element.disabled = bool;
                },
            };

            // ButtonGroup object
            function ButtonGroup(element) {
                this.element = element;
            }

            ButtonGroup.prototype = {
                createButton: function(options) {
                    var defaults = {
                        image: 'fa fa-question-circle',
                        type: 'default',
                        group: 'default',
                        hide: false,
                        disabled: false,
                        editOnly: false,
                        addClass: '',
                    };
                    var optionsMerged = Darkroom.Utils.extend(options, defaults);

                    var buttonElement = document.createElement('button');
                    buttonElement.type = 'button';
                    buttonElement.className = 'darkroom-button darkroom-button-' + optionsMerged.type;
                    // shursh mode ADD title for buttongroup
                    if (optionsMerged.image == 'fa fa-search')
                        this.element.innerHTML += 'Zoom mode:';
                    if (optionsMerged.image == 'fa fa-crop')
                        this.element.innerHTML += 'Crop mode:';
                    if (optionsMerged.image == 'fa fa-step-backward')
                        this.element.innerHTML += 'History bar:';
                    if (optionsMerged.image == 'fa fa-undo oe_edit_only')
                        this.element.innerHTML += 'Rotation bar:';

                    buttonElement.innerHTML += '<i class="' + optionsMerged.image + ' fa-2x"></i>';
                    if (optionsMerged.editOnly) {
                        buttonElement.classList.add('oe_edit_only');
                    }
                    if (optionsMerged.addClass) {
                        buttonElement.classList.add(optionsMerged.addClass);
                    }
                    this.element.appendChild(buttonElement);

                    var button = new Button(buttonElement);
                    button.hide(optionsMerged.hide);
                    button.disable(optionsMerged.disabled);

                    return button;
                }
            };

            // Toolbar object
            function Toolbar(element) {
                this.element = element;
            }

            Toolbar.prototype = {
                createButtonGroup: function() {
                    var buttonGroupElement = document.createElement('div');
                    buttonGroupElement.className = 'darkroom-button-group';
                    this.element.appendChild(buttonGroupElement);

                    return new ButtonGroup(buttonGroupElement);
                }
            };

            Darkroom.UI = {
                Toolbar: Toolbar,
                ButtonGroup: ButtonGroup,
                Button: Button,
            };
        },

        destroy_content: function() {
            if (this.darkroom && this.darkroom.containerElement) {
                this.darkroom.containerElement.remove();
                this.darkroom = null;
            }
        },

        set_value: function(value) {
            return this._super(value);
        },

        _render: function() {
            this.destroy_content();
            this._init_darkroom();
            var self = this;
            var url = this.placeholder;
            if (this.value) {
                if (!utils.is_bin_size(this.value)) {
                    url = 'data:image/png;base64,' + this.value;
                } else {
                    url = session.url('/web/image', {
                        model: this.model,
                        id: JSON.stringify(this.res_id),
                        field: this.nodeOptions.preview_image || this.name,
                        // unique forces a reload of the image when the record has been updated
                        unique: field_utils.format.datetime(this.recordData.__last_update).replace(/[^0-9]/g, ''),
                    });
                }
            }
            console.log(url);
            var $img = $(qweb.render("FieldBinaryImage-img", {widget: this, url: url}));
            this.$('> img').remove();
            this.$el.prepend($img);
            $img.on('error', function () {
                self.on_clear();
                $img.attr('src', self.placeholder);
                self.do_warn(_t("Image"), _t("Could not display the selected image."));
            });
            //shursh mode
            //this.darkroom = new Darkroom($img.get(0), this.options);
            var opt = _.defaults(this.record.context.options, this.nodeOptions);
            this.darkroom = new Darkroom($img.get(0), opt);
            this.darkroom.widget = this;
            },
    });

    field_registry.add('darkroom', FieldDarkroomImage);
    return FieldDarkroomImage;
});
