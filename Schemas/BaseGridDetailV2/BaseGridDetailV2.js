 define("BaseGridDetailV2", [], function() {
		return {
			attributes: {
			},
			mixins: {
			},
			methods: {
				prepareResponseCollectionItem: function(item) {
					this.callParent(arguments);
					if (item.$UseEntityStateEngine && item.mixins && item.mixins.EntityStateEngineMixin) {
						item.mixins.EntityStateEngineMixin.init.call(item);
					}
				},

			}
		};
	}
);