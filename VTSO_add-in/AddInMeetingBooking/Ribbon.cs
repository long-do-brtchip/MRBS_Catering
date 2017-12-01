using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using Microsoft.Office.Tools.Ribbon;
using Outlook = Microsoft.Office.Interop.Outlook;
using Word = Microsoft.Office.Interop.Word;
using System.Windows.Forms;
using AddInUtilities;

namespace AddInMeetingBooking
{
    public partial class Ribbon
    {
        private void DemoRibbon_Load(object sender, RibbonUIEventArgs e)
        {

        }

		private void ShowSelectionText(string inspectorCaption, string selectedText)
		{
			MessageBox.Show(inspectorCaption + selectedText);
		}

		private void btnGetSelectedText_Click(object sender, RibbonControlEventArgs e)
		{
			Outlook.Inspector inspector = e.Control.Context as Outlook.Inspector;
			if (inspector == null)
				return;

			Word.Document document = (Word.Document)inspector.WordEditor;
			var selectedText = document.Application.Selection.Text;
			
			//Mail
			Outlook.MailItem mailItem = inspector.CurrentItem as Outlook.MailItem;
			if (mailItem != null)
			{
				ShowSelectionText("MailItem inspector: ", selectedText);
				return;
			}

			//Appointment
			Outlook.AppointmentItem appointmentItem = inspector.CurrentItem as Outlook.AppointmentItem;
			if (appointmentItem != null)
			{
				ShowSelectionText("AppointmentItem inspector: ", selectedText);
				return;
			}

			//Contact
			Outlook.ContactItem contactItem = inspector.CurrentItem as Outlook.ContactItem;
			if (contactItem != null)
			{
				ShowSelectionText("ContactItem inspector: ", selectedText);
				return;
			}
		}
    }
}
