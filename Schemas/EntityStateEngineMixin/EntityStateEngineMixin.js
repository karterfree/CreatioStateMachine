define("EntityStateEngineMixin", [], function() {
	Ext.define("Terrasoft.configuration.mixins.EntityStateEngineMixin", {
		alternateClassName: "Terrasoft.EntityStateEngineMixin",

		init: function() {
			this.updatePreviousModelColumnsState(this.getModelColumnsState());
			this.subscribeOnEntityColumnChange();
		},

		getNextActualizeModelStateIterationIndex: function() {
			if (!this.$actualizeModelStateIteration) {
				this.$actualizeModelStateIteration = 0;
			}
			return ++this.$actualizeModelStateIteration;
		},

		updatePreviousModelColumnsState: function(previousModelColumnsState) {
			this.set("ESEPreviousModelColumnsState", previousModelColumnsState);
		},

		getEntityColumnNames: function() {
			var columns = this.entitySchema && this.entitySchema.columns || {};
			return Object.keys(columns);
		},

		getEntityColumnChangeSubscribeMessage: function() {
			var columnNames = this.getEntityColumnNames();
			var eventNames = columnNames.map(function(columnName) {return "change:" + columnName;});
			return eventNames.join(" ");
		},

		subscribeOnEntityColumnChange: function() {
			var message = this.getEntityColumnChangeSubscribeMessage();
			this.on(message, this.onEntityColumnChangeHandler, this);
		},

		onEntityColumnChangeHandler: function(model) {
			var changed = this.getChangedModelColumns(model);
			if (!this.$IsEntityInitialized || this.$IsModelStateSetting || !this.modelHasImportantChange(changed)) {
				return;
			}
			if (this.$actualizeDelayTimer) {
				return;
			}
			this.$actualizeDelayTimer = setTimeout(function() {
				this.$actualizeDelayTimer = null;
				this.actualizeModelState(changed);
			}.bind(this), 4);
		},

		getChangedModelColumns: function(model) {
			var rawChanged = model && model.changed || {};
			var entityColumnNames = this.getEntityColumnNames();
			var changed = {};
			this.Terrasoft.each(rawChanged, function(value, name) {
				if (!entityColumnNames.indexOf(name)) {
					return;
				}
				changed[name] = value;
			}, this);
			return changed;
		},

		modelHasImportantChange: function(changedColumns) {
			var hasImportantChange = false;
			this.Terrasoft.each(changedColumns, function(value, name) {
				var columnHasImportantChange = this.modelColumnHasImportantChange(name, value);
				hasImportantChange = hasImportantChange || columnHasImportantChange;
			}, this);

			return hasImportantChange;
		},

		modelColumnHasImportantChange: function(name, value) {
			var column = this.getColumnByName(name);
			if (!column) {
				return false;
			}
			var previousValue = this.getPreviousModelColumnValue(name);
			if (this.Ext.isEmpty(value)) {
				if (Terrasoft.isNumberDataValueType(column.dataValueType) && (previousValue === 0 || this.Ext.isEmpty(previousValue))) {
					return false;
				}
			}
			return true;
		},

		getModelColumnStateSerializedParameter: function(column) {
			var parameter = this.Ext.create("Terrasoft.Parameter")
			parameter.dataValueType = column.dataValueType;
			parameter.value = this.get(column.name);
			var serializedParameter = {};
			parameter.getSerializableObject(serializedParameter, {});
			return serializedParameter;
		},

		getModelColumnState: function(column) {
			var serializedParameter = this.getModelColumnStateSerializedParameter(column);
			return {
				"name": column.name,
				"dataValueType": serializedParameter.dataValueType,
				"value": serializedParameter.value,
				"isChanged": this.getIsModelColumnValueChanged(column.name, serializedParameter.value)
			};
		},

		getIsModelColumnValueChanged: function(name, value) {
			var previousValue = this.getPreviousModelColumnValue(name);
			return previousValue !== value;
		},

		getPreviousModelColumnValue: function(name) {
			var value = null;
			var previousModelColumnsState = this.get("ESEPreviousModelColumnsState") || [];
			this.Terrasoft.each(previousModelColumnsState, function(columnState) {
				if (columnState && columnState.name === name) {
					value = columnState.value;
				}
			}, this);
			return value;
		},

		getModelColumnsState: function() {
			var modelColumnsState = [];
			var columns = this.entitySchema && this.entitySchema.columns || {}
			this.Terrasoft.each(columns, function(column) {
				modelColumnsState.push(this.getModelColumnState(column));
			}, this);
			return modelColumnsState;
		},

		getModelState: function() {
			return {
				"key": this.entitySchema.name,
				"columns": this.getModelColumnsState()
			}
		},

		actualizeModelState: function(changedColumns) {
			var state = this.getModelState();
			var config = {
				"serviceName": "StateActualizeService",
				"methodName": "Actualize",
				"data": {
					"state": state,
					"changed": changedColumns,
					"iteration": this.getNextActualizeModelStateIterationIndex(),
					"isNew": this.isNew || false
				}
			};
			this.callService(config,  function(response) {
				if (response && response.ActualizeResult && response.ActualizeResult.success) {
					this.applyStateToModel(response.ActualizeResult.state);
				} else {
					this.afterApplyStateToModel();
				}
			});
		},

		getIgnoredToApplyColumns: function() {
			return ["Id"];
		},

		beforeApplyStateToModel: function() {
		},

		afterApplyStateToModel: function() {
			this.updatePreviousModelColumnsState(this.getModelColumnsState());
		},

		applyStateToModel: function(state) {
			if (!state) {
				return;
			}
			this.beforeApplyStateToModel();
			var ignoredToApplyColumns = this.getIgnoredToApplyColumns();
			var stateColumns =  this.Terrasoft.filter(state.columns || [], function(column) {
				return ignoredToApplyColumns.indexOf(column.name) < 0 && column.isChanged;
			}, this);
			var lookupColumns = [];
			this.Terrasoft.each(stateColumns, function(stateColumn) {
				if (Terrasoft.isLookupDataValueType(stateColumn.dataValueType) && this.Terrasoft.isGUID(stateColumn.value) && !Terrasoft.isEmptyGUID(stateColumn.value)) {
					lookupColumns.push(stateColumn);
				} else {
					this.setModelStateValue(stateColumn.name, this.normalizeStateColumnValue(stateColumn));
				}
			}, this);

			if (!this.Ext.isEmpty(lookupColumns)) {
				var query = this.getEntityLookupDefaultValuesQuery(lookupColumns);
				query.execute(function(result) {
					if (result && result.success) {
						this.setLookupMovelStateValues(result.queryResults, lookupColumns);
					}
					this.afterApplyStateToModel();
				}, this);
			} else {
				this.afterApplyStateToModel();
			}
		},

		setLookupMovelStateValues: function(queryResults, queryColumns) {
			this.Terrasoft.each(queryResults, function(queryResult, index) {
				if (this.Ext.isEmpty(queryResult) || this.Ext.isEmpty(queryResult.rows)) {
					return;
				}
				this.setModelStateValue(queryColumns[index].name, queryResult.rows[0]);
			}, this);
		},

		getIsDateTimeDataValueType: function(dataValueType) {
			return (dataValueType && (dataValueType === Terrasoft.DataValueType.DATE
				|| dataValueType === Terrasoft.DataValueType.DATE_TIME
				|| dataValueType === Terrasoft.DataValueType.TIME));
		},

		normalizeStateColumnValue: function(stateColumn) {
			if (this.getIsDateTimeDataValueType(stateColumn.dataValueType)) {
				return this.normalizeStateColumnDataValueTypeValue(stateColumn.value)
			}
			if (Terrasoft.isLookupDataValueType(stateColumn.dataValueType)) {
				return this.normalizeStateColumnLookupValueTypeValue(stateColumn.value)
			}
			return stateColumn.value;
		},

		normalizeStateColumnDataValueTypeValue: function(rawValue) {
			return !this.Ext.isEmpty(rawValue)
				? Terrasoft.parseDate(rawValue)
				: null;
		},

		normalizeStateColumnLookupValueTypeValue: function(rawValue) {
			return this.Terrasoft.isGUID(rawValue) && !Terrasoft.isEmptyGUID(rawValue)
				? {"value": rawValue}
				: null;
		},

		setModelStateValue: function(key, value) {
			this.$IsModelStateSetting = true;
			if (this.get(key) !== value) {
				this.set(key, value);
			}
			this.$IsModelStateSetting = false;
		},

		flushState: function() {
			this.updatePreviousModelColumnsState(this.getModelColumnsState());
		},
	});
	return Ext.create("Terrasoft.EntityStateEngineMixin");
});