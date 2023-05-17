define("BasePageV2", ["EntityStateEngineMixin"],
	function() {
		return {
			messages: {
			},
			attributes: {
				"UseEntityStateEngine": {
					dataValueType: Terrasoft.DataValueType.BOOLEAN,
					value: false
				},
			},
			mixins: {
				EntityStateEngineMixin: "Terrasoft.EntityStateEngineMixin"
			},
			methods: {
				onEntityInitialized: function() {
					this.setActiveTabIfCurrentInvisible();
					this.callParent(arguments);
					if (this.$UseEntityStateEngine) {
						this.mixins.EntityStateEngineMixin.init.call(this);
					}
				},

				onDiscardChangesClick: function(callback, scope) {
					if (!this.$UseEntityStateEngine) {
						this.callParent(arguments);
						return;
					}
					const parentMethod = this.getParentMethod();
					parentMethod.call(this, () => {
						this.mixins.EntityStateEngineMixin.flushState.call(this);
						this.Ext.callback(callback, scope);
					}, this);
				},
			},
			diff: /**SCHEMA_DIFF*/[]/**SCHEMA_DIFF*/
		};
	});