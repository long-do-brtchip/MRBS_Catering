using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Xml.Linq;
using Outlook = Microsoft.Office.Interop.Outlook;
using Office = Microsoft.Office.Core;
using Word = Microsoft.Office.Interop.Word;
using System.Windows.Forms;
using AddInMeetingBooking.UserControls;

namespace AddInMeetingBooking
{
    public partial class ThisAddIn
    {
		private Dictionary<Outlook.Inspector, InspectorWrapper> inspectorWrappersValue =
			new Dictionary<Outlook.Inspector, InspectorWrapper>();
		private Outlook.Inspectors inspectors;

        private void ThisAddIn_Startup(object sender, System.EventArgs e)
        {
			// Get the Application object
			Outlook.Application application = this.Application;

			// Get the Inspectors objects
			Outlook.Inspectors inspectors = application.Inspectors;
        }

        private void ThisAddIn_Shutdown(object sender, System.EventArgs e)
        {
			inspectors.NewInspector -= new Outlook.InspectorsEvents_NewInspectorEventHandler(Inspectors_NewInspector);
			inspectors = null;
			inspectorWrappersValue = null;
        }

        /// <summary>
        /// Required method for Designer support - do not modify
        /// the contents of this method with the code editor.
        /// </summary>
        private void InternalStartup()
        {
            this.Startup += new System.EventHandler(ThisAddIn_Startup);
            this.Shutdown += new System.EventHandler(ThisAddIn_Shutdown);

			inspectors = this.Application.Inspectors;
			inspectors.NewInspector += new Outlook.InspectorsEvents_NewInspectorEventHandler(Inspectors_NewInspector);

			foreach (Outlook.Inspector inspector in inspectors)
			{
				Inspectors_NewInspector(inspector);
			}
        }

		// <summary>
		/// Register task panel for AppointmentItem
		/// </summary>
		private void Inspectors_NewInspector(Outlook.Inspector Inspector)
		{
			if (Inspector.CurrentItem is Outlook.AppointmentItem)
			{
				inspectorWrappersValue.Add(Inspector, new InspectorWrapper(Inspector));
			}
		}

		public Dictionary<Outlook.Inspector, InspectorWrapper> InspectorWrappers
		{
			get
			{
				return inspectorWrappersValue;
			}
		}
    }
}
