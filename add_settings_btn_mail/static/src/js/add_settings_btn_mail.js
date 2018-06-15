
odoo.define('add_settings_btn_mail.mail_settings_widget_extend', function (require) {
"use strict";

    var Followers = require('mail.Followers');

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
