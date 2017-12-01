using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Drawing;
using System.Data;
using System.Linq;
using System.Text;
using System.Windows.Forms;

namespace AddInMeetingBooking.UserControls
{
	public partial class BaseUserControl : UserControl
	{
		public BaseUserControl()
		{
			InitializeComponent();
		}

		protected void BindingSourceToCombobox(ComboBox cbx, Dictionary<int, string> itemDic, int selectedValue)
		{
			if (itemDic.Count == 0)
			{
				return;
			}

			cbx.ValueMember = "Key";
			cbx.DisplayMember = "Value";
			cbx.DataSource = new BindingSource(itemDic, null);
			if (itemDic.ContainsKey(selectedValue))
			{
				cbx.SelectedValue = selectedValue;
			}
			else
			{
				cbx.SelectedValue = itemDic.OrderBy(o => o.Key).First().Key;
			}
		}
	}
}
