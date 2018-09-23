/**
*    Copyright 2017 LasLabs Inc.
*    Copyright 2017-2018 Artem Shurshilov
*    License LGPL-3.0 or later (http://www.gnu.org/licenses/lgpl.html).
**/

odoo.define('web_widget_darkroom.darkroom_modal_button', function(require) {
    'use strict';

    var core = require('web.core');
    var rpc = require('web.rpc');
    //var QWeb = core.qweb;
    var QWeb = require('web.QWeb');
    var _t = core._t;
    var base_f = require('web.basic_fields');
    var imageWidget = base_f.FieldBinaryImage;
    var session = require('web.session');
    var utils = require('web.utils');
    var field_utils = require('web.field_utils');


    imageWidget.include({
        events: _.extend({}, imageWidget.prototype.events, {
            'click .oe_form_binary_file_upload': function () {
                this.$('.o_input_file').click();
            },
            'click .oe_form_binary_file_clear': 'on_clear',
        }),
        // Used in template to prevent Darkroom buttons from being added to
        // forms for new records, which are not supported
        darkroom_supported: function() {
            console.log(this);
/*            if (this.field_manager.dataset.index === null) {
                return false;
            }*/
            return true;
        },

        init: function (parent, name, record) {
            this._super.apply(this, arguments);
            var self= this;
            //classic code
            this.$('input.o_form_input_file').change(this.on_file_change);
            this.$('button.oe_form_binary_file_save').click(this.on_save_as);
            this.$('.oe_form_binary_file_clear').click(this.on_clear);
            //override 4 button
            this.$('.oe_form_binary_file_upload').click(function() {
                self.$('input.o_form_input_file').click();
            });
            this.$('.oe_form_binary_file_edit').click(function() {
                self.openModal(null, {'click':'crop'});
            });
            this.$('.oe_form_binary_file_eye').click(function() {
                self.openModal(null, {'click':'zoom'});
            });
            this.$('.oe_form_binary_file_back').click(function() {
                self.back();
            });
            //***from ir_attachment_url
            this.$('.oe_link_address_button').click(function() {
                self.on_link_address();
            });
        },

        // On close modal or click "save button" update image by read js rpc
        updateImage: function() {
            var self = this;
            var ctx = self.getContext();
            //var ActiveModel = new DataModel(ctx.active_model);
            //set origin image
            if (ctx.active_field === 'image_medium')
                ctx.active_field = 'image';
/*            ActiveModel.query([ctx.active_field]).
                filter([['id', '=', ctx.active_record_id]]).
                all().
                then(function(result) {
                    self.set_value(result[0][ctx.active_field]);
                });*/

            rpc.query({
                        model: ctx.active_model,
                        method: 'search_read',
                        args: [[['id', '=', ctx.active_record_id]]],
                        context: ctx,
                    }).
                    then(function(result) {
                        self.set_value(result[0][ctx.active_field]);
                    });
        },

        openModal: function(file_base64, clickDefault) {
            var self = this;
            var context = self.getContext();
            if (file_base64)
                //give current image and options from Image widget to Darkroom widget by context
                context.current_image = file_base64
            else
                //context for python function _default_image, open original image, not medium or small
                context.size_image = 'image';
            if (clickDefault)
                context.click = clickDefault.click;
            //console.log("openModal");
            //console.log(context);
            var modalAction = {
                type: 'ir.actions.act_window',
                res_model: 'darkroom.modal',
                name: 'Darkroom',
                views: [[false, 'form']],
                target: 'new',
                context: context,
            };
            var updateImage =  function() {
                self.updateImage();
            };
            var options = {on_close: updateImage};
            self.do_action(modalAction, options);
        },

        getContext: function() {
            var self = this;
            var activeModel = self.model;
            var activeRecordId = self.res_id;
            //var activeField = self.node.attrs.name;
            var activeField = self.attrs.name;
            return {
                active_model: activeModel,
                active_record_id: activeRecordId,
                active_field: activeField,
                //options: self.options,
            };
        },
        on_file_uploaded_and_valid: function(size, name, content_type, file_base64) {
            this.set_filename(name);
            this._setValue(file_base64);
            this._render();
            //shursh mode current image in context to modal 
            //and give options to Darkroom widget
            this.openModal(file_base64, {'click':'crop'});
        },
        _render: function() {
            console.log("213");
            var self = this;
            if (this.is_url_valid(this.value)) {
                    console.log("найден URL");
                    var attrs = this.attrs;
                    var url = this.placeholder;
                    if (this.value) {
                        url = this.value;
                    }
                    var $img = $('<img>').attr('src', url);
                    $img.css({
                        width: this.nodeOptions.size
                        ? this.nodeOptions.size[0]
                        : attrs.img_width || attrs.width,
                        height: this.nodeOptions.size
                        ? this.nodeOptions.size[1]
                        : attrs.img_height || attrs.height,
                    });
                    this.$('> img').remove();
                    this.$el.prepend($img);
                    $img.on('error', function () {
                        self.on_clear();
                        $img.attr('src', self.placeholder);
                        self.do_warn(_t("Image"), _t("Could not display the selected image."));
                    }); 
            }
            else {
                this.$el.children(".input_url").remove();
                this._super.apply(this, arguments);              
                this.imgSrc = this.placeholder;
                if (this.value) {
                    if (!utils.is_bin_size(this.value)) {
                        this.imgSrc = 'data:image/png;base64,' + this.value;
                    } else {
                        var field = this.nodeOptions.preview_image || this.name;
                        if (field == "image_medium" ||
                        field == "image_small")                
                        field = "image";
                        this.imgSrc = session.url('/web/image', {
                            model: this.model,
                            id: JSON.stringify(this.res_id),
                            field: field,
                            // unique forces a reload of the image when the record has been updated
                            // unique: (this.recordData.__last_update || '').replace(/[^0-9]/g, ''),
                            // check bug 17.01.18
                          unique: field_utils.format.datetime(this.recordData.__last_update).replace(/[^0-9]/g, ''),
                        });
                    }
                }
                //***from web_widget_image_download
                var $widget = this.$el.find('.oe_form_binary_file_download');
                $widget.attr('href', this.imgSrc);
                $widget.attr('download', 'image.png');

                //original size href with target=_blank
                this.$el.find('.oe_form_binary_file_expand').attr('href', this.imgSrc);
            
                //***from field_image_preview
                var image = this.$el.find('img[name="' + this.name + '"]');
                $(image).click(function(e) {
                        // set attr SRC image, in our hidden div
                        var a = $('#outer').find('img')[0]
                        if (a) a.remove();
                        $('#outer').prepend('<img id="inner" src="'+self.imgSrc+'" />');
                        //change css of parent because class oe_avatar 90x90 size maximum
                        $('#outer').find('img').parent().css=({
                            width:'100%',
                            height:'100%',            
                        });         
                        $('#outer').fadeIn('slow');
                
                        $('#outer').click(function(e)
                        {
                            self.$('#inner').remove();
                            $(this).fadeOut();

                        });
                        $(document).mouseup(function (e){ // action click on web-document
                            var div = $("#outer"); // ID-element
                            if (!div.is(e.target) // if click NO our elementе
                               && div.has(e.target).length === 0) { // and NO our children elemets
                                    div.hide(); 
                            }
                        });
                        
                });
            }
            
        },
        //***from ir_attachment_url
        on_link_address: function() {
            var self = this;
            this.$el.children(".img-responsive").remove();
            this.$el.children(".input_url").remove();
            this.$el.children(".o_form_image_controls").addClass("media_url_controls");
            this.$el.prepend($(QWeb.render("AttachmentURL", {widget: this})));
            this.$('.input_url input').on('change', function() {
                var input_val = $(this).val();
                self._setValue(input_val);
            });
        },
        is_url_valid: function(value) {
            if (value || (this.$input && this.$input.is('input'))) {
                var u = new RegExp("^(http[s]?:\\/\\/(www\\.)?|ftp:\\/\\/(www\\.)?|www\\.){1}([0-9A-Za-z-\\.@:%_~#=]+)+((\\.[a-zA-Z]{2,3})+)(/(.)*)?(\\?(.)*)?");
                return u.test(value || this.$input.val());
            }
            return false;
        },

    });
});
