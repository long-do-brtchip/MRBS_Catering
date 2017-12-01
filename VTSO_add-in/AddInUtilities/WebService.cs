using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Net;
using AddInEntity;
using System.Web.Script.Serialization;
using System.IO;

namespace AddInUtilities
{
	public class WebService
	{
		private const string IpAddress = "localhost";
		private const int Port = 8081;

		private HttpWebRequest GetHttpWebRequest(string apiName, string method, string contentType = null)
		{
			var url = string.Format("http://{0}:{1}/api/{2}", IpAddress, Port, apiName);
			var request = (HttpWebRequest)WebRequest.Create(url);
			request.Method = method;
			if (contentType != null)
			{
				request.ContentType = contentType;
			}

			return request;
		}

		public List<Equipment> GetEquipments(string apiName)
		{
			try
			{
				var request = GetHttpWebRequest(apiName, "GET");
				using (var response = (HttpWebResponse)request.GetResponse())
				{
					using (var reader = new StreamReader(response.GetResponseStream()))
					{
						string responseText = reader.ReadToEnd();
						return new JavaScriptSerializer().Deserialize<List<Equipment>>(responseText);
					}
				}
			}
			catch (Exception ex)
			{
				return null;
			}
		}

		public List<EquipmentItem> GetEquipmentItems(string apiName)
		{
			try
			{
				var request = GetHttpWebRequest(apiName, "GET");
				using (var response = (HttpWebResponse)request.GetResponse())
				{
					using (var reader = new StreamReader(response.GetResponseStream()))
					{
						string responseText = reader.ReadToEnd();
						return new JavaScriptSerializer().Deserialize<List<EquipmentItem>>(responseText);
					}
				}
			}
			catch (Exception ex)
			{
				return null;
			}
		}

		public bool PostEquipmentItems(string apiName, List<EquipmentItem> equipmentItems)
		{
			try
			{
				var request = GetHttpWebRequest(apiName, "POST", "application/json");
				var jsonData = new JavaScriptSerializer().Serialize(equipmentItems);
				var data = Encoding.ASCII.GetBytes(jsonData);
				request.ContentLength = data.Length;

				using (var stream = request.GetRequestStream())
				{
					stream.Write(data, 0, data.Length);
					stream.Flush();
					stream.Close();
				}

				//using (var response = (HttpWebResponse)request.GetResponse())
				//{
				//    var responseString = new StreamReader(response.GetResponseStream()).ReadToEnd();
				//}

				return true;
			}
			catch (Exception ex)
			{
				return false;
			}
		}
	}
}
