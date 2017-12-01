using System;
using System.Text;
using System.Collections.Generic;
using System.Linq;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using AddInUtilities;
using AddInEntity;
using System.Web.Script.Serialization;

namespace AddInUnistTest
{
	[TestClass]
	public class WebServiceTest
	{
		[TestMethod]
		public void GetEquipments()
		{
			var equipments = new WebService().GetEquipments("Equipments");
			Assert.IsTrue(equipments.Count == 2);
			Assert.IsTrue(equipments[0].EquipmentType == EquipmentType.TV);
			Assert.IsTrue(equipments[0].EquipmentName == "TV");
			Assert.IsTrue(equipments[1].EquipmentType == EquipmentType.Projector);
			Assert.IsTrue(equipments[1].EquipmentName == "Projector");
		}

		[TestMethod]
		public void PostEquipments()
		{
			var jsonData = @"[ { EquipmentType: 0, EquipmentName: 'TV' }, { EquipmentType: 1, EquipmentName: 'Projector' } ]";
			var equipmentItems = new JavaScriptSerializer().Deserialize<List<EquipmentItem>>(jsonData);
			var result = new WebService().PostEquipmentItems("Equipments", equipmentItems);
			Assert.IsTrue(result);
		}
	}
}
