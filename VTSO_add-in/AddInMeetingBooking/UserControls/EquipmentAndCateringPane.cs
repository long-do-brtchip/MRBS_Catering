using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Drawing;
using System.Data;
using System.Linq;
using System.Text;
using System.Windows.Forms;
using AddInUtilities;
using AddInEntity;
using Outlook = Microsoft.Office.Interop.Outlook;
using Word = Microsoft.Office.Interop.Word;

namespace AddInMeetingBooking.UserControls
{
	public partial class EquipmentAndCateringPane : BaseUserControl
	{
		private List<EquipmentItem> mEquipmentItems = new List<EquipmentItem>();
		private List<Equipment> mEquipments = new List<Equipment>();

		public EquipmentAndCateringPane()
		{
			InitializeComponent();
		}

		private void FilterEquipment()
		{
			dgvEquipment.Rows.Clear();

			var equipmentType = (EquipmentType)cbEquiqment.SelectedValue;

			var equipmentItems = (equipmentType == EquipmentType.All) ? mEquipmentItems
				: mEquipmentItems.Where(o => o.EquipmentType == equipmentType).ToList();

			equipmentItems = (txtFilter.Text.Trim() == string.Empty) ? equipmentItems
				: equipmentItems.Where(o => o.EquipmentItemName.ToLower().Contains(txtFilter.Text.ToLower())).ToList();

			foreach (var item in equipmentItems)
			{
				dgvEquipment.Rows.Add(item.EquipmentType, item.EquipmentItemName);
			}
		}

		private void EquipmentAndCateringPane_Load(object sender, EventArgs e)
		{
			try
			{
				mEquipments = new WebService().GetEquipments("Equipments");
				var itemDic = new Dictionary<int, string>();
				itemDic[(int)EquipmentType.All] = "All";
				foreach (var item in mEquipments)
				{
					itemDic[(int)item.EquipmentType] = item.EquipmentName;
				}

				BindingSourceToCombobox(cbEquiqment, itemDic, -1);
				mEquipmentItems = new WebService().GetEquipmentItems("EquipmentItems");
				FilterEquipment();
			}
			catch (Exception ex)
			{
				this.Enabled = false;
			}
		}

		private void cbEquiqment_SelectionChangeCommitted(object sender, EventArgs e)
		{
			FilterEquipment();
		}

		private void txtFilter_TextChanged(object sender, EventArgs e)
		{
			FilterEquipment();
		}


		private void btnAdd_Click(object sender, EventArgs e)
		{
			try
			{
				foreach (DataGridViewRow row in dgvEquipment.SelectedRows)
				{
					var equipmentType = (EquipmentType)row.Cells[0].Value;
					var equipmentItemName = (string)row.Cells[1].Value;
					var equipmentName = mEquipments.FirstOrDefault(o => o.EquipmentType == equipmentType).EquipmentName;
					var index = dgvEquimentDetail.Rows.Count;
					dgvEquimentDetail.Rows.Add(index + 1, equipmentName, equipmentItemName, 1);
				}
			}
			catch (Exception ex)
			{
			}
		}

		private void btnRemove_Click(object sender, EventArgs e)
		{
			try
			{
				foreach (DataGridViewRow row in dgvEquimentDetail.SelectedRows)
				{
					dgvEquimentDetail.Rows.Remove(row);
				}
			}
			catch (Exception ex)
			{
			}
		}

		private void btnOk_Click(object sender, EventArgs e)
		{
			try
			{
				Outlook.Application application = Globals.ThisAddIn.Application;
				Outlook.Inspector inspector = application.ActiveInspector();
				Outlook.AppointmentItem appointmentItem = inspector.CurrentItem as Outlook.AppointmentItem;
				if (appointmentItem != null)
				{
					Word.Document document = (Word.Document)inspector.WordEditor;

					var header = "Id\t\tCatalogue\t\tDevice Name\t\tNumber\n";
					var body = string.Empty;

					foreach (DataGridViewRow row in dgvEquimentDetail.Rows)
					{
						var id = (int)row.Cells[0].Value;
						var catalogue = (string)row.Cells[1].Value;
						var deviceName = (string)row.Cells[2].Value;
						var number = (int)row.Cells[3].Value;

						body += string.Format("{0}\t\t{1}\t\t\t{2}\t\t{3}\n", id, catalogue, deviceName, number);
					}

					document.Application.Selection.Text = header + body;
				}
			}
			catch (Exception ex)
			{
			}
		}
	}
}
