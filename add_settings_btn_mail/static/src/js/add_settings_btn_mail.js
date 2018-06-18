
odoo.define('add_settings_btn_mail.mail_settings_widget_extend', function (require) {
"use strict";

    var Followers = require('mail.Followers');
    var ThreadField = require('mail.ThreadField');
    var ChatThread = require('mail.ChatThread');
    var concurrency = require('web.concurrency');
    var core = require('web.core');
    var session = require('web.session');
    var data = require('web.data');
    var ActionManager = require('web.ActionManager');
    var chat_manager = require('mail.chat_manager');
    var Chatter = require('mail.Chatter');
    var _t = core._t;
    var QWeb = core.qweb;
    var time = require('web.time');
    var rpc = require('web.rpc');
    var config = require('web.config');

    var ORDER = {
        ASC: 1,
        DESC: -1,
    };
 

    Chatter.include({
        //action by click
        events: {
            'click .o_chatter_button_new_message': '_onOpenComposerMessage',
            'click .o_chatter_button_log_note': '_onOpenComposerNote',
            'click .o_chatter_button_schedule_activity': '_onScheduleActivity',
            'click .o_filter_checkbox': '_update',
        },
 // public
    update: function (record, fieldNames) {
        var self = this;

        // close the composer if we switch to another record as it is record dependent
        if (this.record.res_id !== record.res_id) {
            this._closeComposer(true);
            //console.log('updateOLD');
            //console.log(this.fields.thread.res_id);
            this.fields.thread.res_id = record.res_id;
            //console.log(this.fields.thread.res_id);
            rpc.query({
                        model: this.fields.thread.model,
                        method: 'read',
                        args: [[this.fields.thread.res_id], ['hide_notification']],

                    }).then(function(result){
                        //console.log('hide_notification read');
                        //console.log(hide_notification);
                        //console.log('result');
                        //console.log(hide_notification);
                        if (result[0].hide_notification){
                            self.$('.o_filter_checkbox').prop( "checked", true );
                            _.extend(self.fields.thread.thread.options, {filter: 'yes',});
                        }
                        else{
                            self.$('.o_filter_checkbox').prop( "checked", false );                        
                            _.extend(self.fields.thread.thread.options, {filter: 'no',});
                        }                           

                       self.update(record);
                    });
        }

           
        // update the state
        this._setState(record);

        // detach the thread and activity widgets (temporarily force the height to prevent flickering)
        // keep the followers in the DOM as it has a synchronous pre-rendering
        this.$el.height(this.$el.height());
        if (this.fields.activity) {
            this.fields.activity.$el.detach();
        }
        if (this.fields.thread) {
            this.fields.thread.$el.detach();
        }

        // reset and re-append the widgets (and reset 'height: auto' rule)
        // if fieldNames is given, only reset those fields, otherwise reset all fields
        var fieldsToReset;
        if (fieldNames) {
            fieldsToReset = _.filter(this.fields, function (field) {
                return _.contains(fieldNames, field.name);
            });
        } else {
            fieldsToReset = this.fields;
        }
        var fieldDefs = _.invoke(fieldsToReset, 'reset', record);
        var def = this.dp.add($.when.apply($, fieldDefs));
        this._render(def).then(function () {
            self.$el.height('auto');
            self._updateMentionSuggestions();
        });
    },

        //read from DB field hide_notification and change checkbox and reload message
        start: function () {
            var res = this._super.apply(this, arguments);
            var self = this;
            //console.log('start');
            //console.log(this.fields.thread);
            rpc.query({
                        model: this.fields.thread.model,
                        method: 'read',
                        args: [[this.fields.thread.res_id], ['hide_notification']],

                    }).then(function(result){
                        if (result[0].hide_notification){
                            self.$('.o_filter_checkbox').prop( "checked", true );
                            _.extend(self.fields.thread.thread.options, {filter: 'yes',});
                        }
                        else{
                            self.$('.o_filter_checkbox').prop( "checked", false );                        
                            _.extend(self.fields.thread.thread.options, {filter: 'no',});
                        }                        
                        self.update(self.fields.thread.record);
                        });

            return res;
        },

        //Write to current model status checkbox and reload message (filtered)
        _update: function () {
            console.log('update BUTTON');
            var check = false

            if (this.$('.o_filter_checkbox')[0].checked) {
                _.extend(this.fields.thread.thread.options, {filter: 'yes',});
                check = true
            }
            else
                _.extend(this.fields.thread.thread.options, {filter: 'no',});

            rpc.query({
                        model: this.fields.thread.model,
                        method: 'write',
                        args: [[this.fields.thread.res_id], {
                                hide_notification: check,
            },],
                    })
            this.update(this.fields.thread.record);
            //this.fields.thread._onUpdateMessage(this.fields.thread.msgIDs);



        },
    });
    ChatThread.include({
        render: function (messages, options) {
 //           if (options.filter == 'yes')
 //               messages = _.filter(messages, function(msg){ return (msg.message_type == 'email'); });
            var self = this;
            var msgs = _.map(messages, this._preprocess_message.bind(this));
            if (this.options.display_order === ORDER.DESC) {
                msgs.reverse();
            }
            options = _.extend({}, this.options, options);

            // Hide avatar and info of a message if that message and the previous
            // one are both comments wrote by the same author at the same minute
            // and in the same document (users can now post message in documents
            // directly from a channel that follows it)
            var prev_msg;
            _.each(msgs, function (msg) {
                if (!prev_msg || (Math.abs(msg.date.diff(prev_msg.date)) > 60000) ||
                    prev_msg.message_type !== 'comment' || msg.message_type !== 'comment' ||
                    (prev_msg.author_id[0] !== msg.author_id[0]) || prev_msg.model !== msg.model ||
                    prev_msg.res_id !== msg.res_id) {
                    msg.display_author = true;
                } else {
                    msg.display_author = !options.squash_close_messages;
                }
                prev_msg = msg;
            });
            //my
            //console.log(options.filter)
            if (options.filter == 'yes')
                msgs = _.filter(msgs, function(msg){ return (msg.message_type == 'comment' || msg.message_type == 'email' ); });
            //msgs = _.filter(msgs, function(msg){ return (msg.message_type == 'comment' || msg.message_type == 'email' ); });
            //msgs = _.filter(msgs, function(msg){ return (msg.message_type == 'email'); });

            this.$el.html(QWeb.render('mail.ChatThread', {
                messages: msgs,
                options: options,
                ORDER: ORDER,
                date_format: time.getLangDatetimeFormat(),
            }));

            this.attachments = _.uniq(_.flatten(_.map(messages, 'attachment_ids')));

            _.each(msgs, function(msg) {
                var $msg = self.$('.o_thread_message[data-message-id="'+ msg.id +'"]');
                $msg.find('.o_mail_timestamp').data('date', msg.date);

                self.insert_read_more($msg);
            });

            if (!this.update_timestamps_interval) {
                this.update_timestamps_interval = setInterval(function() {
                    self.update_timestamps();
                }, 1000*60);
            }
        },
        _preprocess_message: function (message) {
            var msg = this._super.apply(this, arguments);
           // msg.partner_trackings = msg.partner_trackings || [];
           msg.day = _t("Today111");
            return msg;
        },
    });


    Followers.include({
        events: {
        // click on '(Un)Follow' button, that toggles the follow for uid
        'click .o_followers_follow_button': '_onFollowButtonClicked',
        // click on a subtype, that (un)subscribes for this subtype
        'click .o_subtypes_list input': '_onSubtypeClicked',
        // click on 'invite' button, that opens the invite wizard
        'click .o_add_follower': '_onAddFollower',
        'click .o_add_follower_channel': '_onAddChannel',
        // click on 'edit_subtype' (pencil) button to edit subscription
        'click .o_edit_subtype': '_onEditSubtype',
        'click .o_remove_follower': '_onRemoveFollower',
        'click .o_mail_redirect': '_onRedirect',
        //add action on settings btn
        'click .o_setting': '_onWizzard',
    },

        _onWizzard: function () {
                var settingsWidget = this;
                var activeModel = settingsWidget.record.model;
                var activeRecordId = settingsWidget.record.data.id;
                var activeField = settingsWidget.attrs.name;

                var openModal = function() {
                    var context = {
                        active_model: activeModel,
                        active_record_id: activeRecordId,
                        active_field: activeField,
                    };
                    var modalAction = {
                        type: 'ir.actions.act_window',
                        res_model: 'neuro.job',
                        name: 'Settings',
                        views: [[false, 'form']],
                        target: 'new',
                        context: context,
                    };
                    settingsWidget.do_action(modalAction);
                };
                openModal();
    },

    });
});
