using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace AddInEntity
{
	public enum EquipmentType : int
	{
		All = -1,
		TV = 0,
		Projector,
		Laptops,
		VideoConferenceDevice,
	}

	public class Equipment
	{
		public EquipmentType EquipmentType { get; set; }
		public string EquipmentName { get; set; }
	}

	public class EquipmentItem
	{
		public EquipmentType EquipmentType { get; set; }
		public string EquipmentItemName { get; set; }
	}

	public class EquipmentDetail
	{
		public EquipmentType EquipmentType { get; set; }
		public string EquipmentName { get; set; }
		public string EquipmentItemName { get; set; }
		public int NumberOfItem { get; set; }
	}
}
