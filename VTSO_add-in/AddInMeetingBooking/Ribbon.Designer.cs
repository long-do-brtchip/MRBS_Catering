namespace AddInMeetingBooking
{
    partial class Ribbon : Microsoft.Office.Tools.Ribbon.RibbonBase
    {
        /// <summary>
        /// Required designer variable.
        /// </summary>
        private System.ComponentModel.IContainer components = null;

        public Ribbon()
            : base(Globals.Factory.GetRibbonFactory())
        {
            InitializeComponent();
        }

        /// <summary> 
        /// Clean up any resources being used.
        /// </summary>
        /// <param name="disposing">true if managed resources should be disposed; otherwise, false.</param>
        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Component Designer generated code

        /// <summary>
        /// Required method for Designer support - do not modify
        /// the contents of this method with the code editor.
        /// </summary>
        private void InitializeComponent()
        {
			Microsoft.Office.Tools.Ribbon.RibbonDialogLauncher ribbonDialogLauncherImpl1 = this.Factory.CreateRibbonDialogLauncher();
			System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(Ribbon));
			this.tab1 = this.Factory.CreateRibbonTab();
			this.group1 = this.Factory.CreateRibbonGroup();
			this.btnGetSelectedText = this.Factory.CreateRibbonButton();
			this.button1 = this.Factory.CreateRibbonButton();
			this.tab1.SuspendLayout();
			this.group1.SuspendLayout();
			// 
			// tab1
			// 
			this.tab1.ControlId.ControlIdType = Microsoft.Office.Tools.Ribbon.RibbonControlIdType.Office;
			this.tab1.Groups.Add(this.group1);
			this.tab1.Label = "My Add In";
			this.tab1.Name = "tab1";
			// 
			// group1
			// 
			this.group1.DialogLauncher = ribbonDialogLauncherImpl1;
			this.group1.Items.Add(this.btnGetSelectedText);
			this.group1.Name = "group1";
			// 
			// btnGetSelectedText
			// 
			this.btnGetSelectedText.Label = "Get Text Selected";
			this.btnGetSelectedText.Name = "btnGetSelectedText";
			this.btnGetSelectedText.ShowImage = true;
			this.btnGetSelectedText.Click += new Microsoft.Office.Tools.Ribbon.RibbonControlEventHandler(this.btnGetSelectedText_Click);
			// 
			// button1
			// 
			this.button1.Label = "button1";
			this.button1.Name = "button1";
			this.button1.ShowImage = true;
			// 
			// Ribbon
			// 
			this.Name = "Ribbon";
			// 
			// Ribbon.OfficeMenu
			// 
			this.OfficeMenu.Items.Add(this.button1);
			this.RibbonType = resources.GetString("$this.RibbonType");
			this.Tabs.Add(this.tab1);
			this.Load += new Microsoft.Office.Tools.Ribbon.RibbonUIEventHandler(this.DemoRibbon_Load);
			this.tab1.ResumeLayout(false);
			this.tab1.PerformLayout();
			this.group1.ResumeLayout(false);
			this.group1.PerformLayout();

        }

        #endregion

        internal Microsoft.Office.Tools.Ribbon.RibbonTab tab1;
		internal Microsoft.Office.Tools.Ribbon.RibbonGroup group1;
        internal Microsoft.Office.Tools.Ribbon.RibbonButton btnGetSelectedText;
		internal Microsoft.Office.Tools.Ribbon.RibbonButton button1;
    }

    partial class ThisRibbonCollection
    {
        internal Ribbon DemoRibbon
        {
            get { return this.GetRibbon<Ribbon>(); }
        }
    }
}
