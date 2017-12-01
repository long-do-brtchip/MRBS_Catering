using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using Microsoft.Office.Tools;
using AddInMeetingBooking.UserControls;
using Outlook = Microsoft.Office.Interop.Outlook;

namespace AddInMeetingBooking
{
	public class InspectorWrapper
	{
		private Microsoft.Office.Interop.Outlook.Inspector inspector;
		private CustomTaskPane taskPane;

		public InspectorWrapper(Microsoft.Office.Interop.Outlook.Inspector Inspector)
		{
			inspector = Inspector;
			((Outlook.InspectorEvents_Event)inspector).Close += new Outlook.InspectorEvents_CloseEventHandler(InspectorWrapper_Close);
			taskPane = Globals.ThisAddIn.CustomTaskPanes.Add(new EquipmentAndCateringPane(), "Equipment and Catering ", inspector);
			taskPane.Width = 800;
			taskPane.Visible = true;
			taskPane.VisibleChanged += new EventHandler(TaskPane_VisibleChanged);
		}

		private void InspectorWrapper_Close()
		{
			if (taskPane != null)
			{
				Globals.ThisAddIn.CustomTaskPanes.Remove(taskPane);
			}

			taskPane = null;
			Globals.ThisAddIn.InspectorWrappers.Remove(inspector);
			((Outlook.InspectorEvents_Event)inspector).Close -=new Outlook.InspectorEvents_CloseEventHandler(InspectorWrapper_Close);
			inspector = null;
		}

		private void TaskPane_VisibleChanged(object sender, EventArgs e)
		{
		}
	}

}
