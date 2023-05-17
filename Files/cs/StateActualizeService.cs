namespace CreatioStateMachine
{
	using System;
	using System.Runtime.Serialization;
	using System.ServiceModel;
	using System.ServiceModel.Activation;
	using System.ServiceModel.Web;
	using CreatioStateEngine;
	using Terrasoft.Core.Factories;
	using Terrasoft.Web.Common;

	#region Class: StateActualizeService

	[ServiceContract]
	[AspNetCompatibilityRequirements(RequirementsMode = AspNetCompatibilityRequirementsMode.Required)]
	public class StateActualizeService: BaseService
	{
		#region Methods: Public

		[OperationContract]
		[WebInvoke(Method = "POST", BodyStyle = WebMessageBodyStyle.Wrapped,
			RequestFormat = WebMessageFormat.Json, ResponseFormat = WebMessageFormat.Json)]
		public StateActualizeResponse Actualize(ClientStateDto state) {
			var response = new StateActualizeResponse();
			try {
				IStateEngineExecutor executor = StateEngineExecutorFactory.GetExecutor();
				response.State = executor.ClientSideExecute(UserConnection, state);
			} catch (Exception e) {
				response.Success = false;
				response.ErrorMessage = e.Message;
			}
			return response;
		}

		#endregion
	}
	#endregion

	#region Class: StateActualizeResponse

	[DataContract]
	public class StateActualizeResponse
	{
		[DataMember(Name = "success")]
		public bool Success { get; set; }

		[DataMember(Name = "errorMessage")]
		public string ErrorMessage { get; set; }

		[DataMember(Name = "state")]
		public ClientStateDto State { get; set; }

		public StateActualizeResponse() {
			Success = true;
		}
	}

	#endregion

}
