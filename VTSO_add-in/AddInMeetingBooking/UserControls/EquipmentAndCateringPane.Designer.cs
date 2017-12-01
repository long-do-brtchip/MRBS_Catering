namespace AddInMeetingBooking.UserControls
{
	partial class EquipmentAndCateringPane
	{
		/// <summary> 
		/// Required designer variable.
		/// </summary>
		private System.ComponentModel.IContainer components = null;

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
			this.tabCatering = new System.Windows.Forms.TabControl();
			this.tabEquipment = new System.Windows.Forms.TabPage();
			this.btnRemove = new System.Windows.Forms.Button();
			this.splitContainer1 = new System.Windows.Forms.SplitContainer();
			this.dgvEquipment = new System.Windows.Forms.DataGridView();
			this.ColEquipmentId = new System.Windows.Forms.DataGridViewTextBoxColumn();
			this.ColEquipmentName = new System.Windows.Forms.DataGridViewTextBoxColumn();
			this.dgvEquimentDetail = new System.Windows.Forms.DataGridView();
			this.ColIndex = new System.Windows.Forms.DataGridViewTextBoxColumn();
			this.ColCatalogue = new System.Windows.Forms.DataGridViewTextBoxColumn();
			this.ColDeviceName = new System.Windows.Forms.DataGridViewTextBoxColumn();
			this.ColNumber = new System.Windows.Forms.DataGridViewTextBoxColumn();
			this.btnOk = new System.Windows.Forms.Button();
			this.btnAdd = new System.Windows.Forms.Button();
			this.txtFilter = new System.Windows.Forms.TextBox();
			this.label1 = new System.Windows.Forms.Label();
			this.cbEquiqment = new System.Windows.Forms.ComboBox();
			this.tabPage1 = new System.Windows.Forms.TabPage();
			this.button1 = new System.Windows.Forms.Button();
			this.label3 = new System.Windows.Forms.Label();
			this.lbxFoodInfo = new System.Windows.Forms.ListBox();
			this.cmbCateringPackages = new System.Windows.Forms.ComboBox();
			this.label2 = new System.Windows.Forms.Label();
			this.tabCatering.SuspendLayout();
			this.tabEquipment.SuspendLayout();
			((System.ComponentModel.ISupportInitialize)(this.splitContainer1)).BeginInit();
			this.splitContainer1.Panel1.SuspendLayout();
			this.splitContainer1.Panel2.SuspendLayout();
			this.splitContainer1.SuspendLayout();
			((System.ComponentModel.ISupportInitialize)(this.dgvEquipment)).BeginInit();
			((System.ComponentModel.ISupportInitialize)(this.dgvEquimentDetail)).BeginInit();
			this.tabPage1.SuspendLayout();
			this.SuspendLayout();
			// 
			// tabCatering
			// 
			this.tabCatering.Controls.Add(this.tabEquipment);
			this.tabCatering.Controls.Add(this.tabPage1);
			this.tabCatering.Dock = System.Windows.Forms.DockStyle.Fill;
			this.tabCatering.Font = new System.Drawing.Font("Microsoft Sans Serif", 8.25F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(163)));
			this.tabCatering.Location = new System.Drawing.Point(0, 0);
			this.tabCatering.Name = "tabCatering";
			this.tabCatering.SelectedIndex = 0;
			this.tabCatering.Size = new System.Drawing.Size(633, 379);
			this.tabCatering.TabIndex = 1;
			// 
			// tabEquipment
			// 
			this.tabEquipment.Controls.Add(this.btnRemove);
			this.tabEquipment.Controls.Add(this.splitContainer1);
			this.tabEquipment.Controls.Add(this.btnOk);
			this.tabEquipment.Controls.Add(this.btnAdd);
			this.tabEquipment.Controls.Add(this.txtFilter);
			this.tabEquipment.Controls.Add(this.label1);
			this.tabEquipment.Controls.Add(this.cbEquiqment);
			this.tabEquipment.Location = new System.Drawing.Point(4, 22);
			this.tabEquipment.Name = "tabEquipment";
			this.tabEquipment.Padding = new System.Windows.Forms.Padding(3);
			this.tabEquipment.Size = new System.Drawing.Size(625, 353);
			this.tabEquipment.TabIndex = 1;
			this.tabEquipment.Text = "Equipment";
			this.tabEquipment.UseVisualStyleBackColor = true;
			// 
			// btnRemove
			// 
			this.btnRemove.Anchor = System.Windows.Forms.AnchorStyles.Top;
			this.btnRemove.Location = new System.Drawing.Point(544, 60);
			this.btnRemove.Name = "btnRemove";
			this.btnRemove.Size = new System.Drawing.Size(75, 29);
			this.btnRemove.TabIndex = 8;
			this.btnRemove.Text = "Remove";
			this.btnRemove.UseVisualStyleBackColor = true;
			this.btnRemove.Click += new System.EventHandler(this.btnRemove_Click);
			// 
			// splitContainer1
			// 
			this.splitContainer1.Anchor = ((System.Windows.Forms.AnchorStyles)((((System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom) 
            | System.Windows.Forms.AnchorStyles.Left) 
            | System.Windows.Forms.AnchorStyles.Right)));
			this.splitContainer1.Location = new System.Drawing.Point(12, 95);
			this.splitContainer1.Name = "splitContainer1";
			// 
			// splitContainer1.Panel1
			// 
			this.splitContainer1.Panel1.Controls.Add(this.dgvEquipment);
			// 
			// splitContainer1.Panel2
			// 
			this.splitContainer1.Panel2.Controls.Add(this.dgvEquimentDetail);
			this.splitContainer1.Size = new System.Drawing.Size(610, 215);
			this.splitContainer1.SplitterDistance = 187;
			this.splitContainer1.TabIndex = 7;
			// 
			// dgvEquipment
			// 
			this.dgvEquipment.AllowUserToAddRows = false;
			this.dgvEquipment.AllowUserToDeleteRows = false;
			this.dgvEquipment.AllowUserToResizeColumns = false;
			this.dgvEquipment.AllowUserToResizeRows = false;
			this.dgvEquipment.AutoSizeRowsMode = System.Windows.Forms.DataGridViewAutoSizeRowsMode.AllCells;
			this.dgvEquipment.BackgroundColor = System.Drawing.Color.White;
			this.dgvEquipment.ColumnHeadersHeightSizeMode = System.Windows.Forms.DataGridViewColumnHeadersHeightSizeMode.AutoSize;
			this.dgvEquipment.ColumnHeadersVisible = false;
			this.dgvEquipment.Columns.AddRange(new System.Windows.Forms.DataGridViewColumn[] {
            this.ColEquipmentId,
            this.ColEquipmentName});
			this.dgvEquipment.Dock = System.Windows.Forms.DockStyle.Fill;
			this.dgvEquipment.EditMode = System.Windows.Forms.DataGridViewEditMode.EditOnEnter;
			this.dgvEquipment.Location = new System.Drawing.Point(0, 0);
			this.dgvEquipment.Name = "dgvEquipment";
			this.dgvEquipment.RowHeadersVisible = false;
			this.dgvEquipment.ScrollBars = System.Windows.Forms.ScrollBars.None;
			this.dgvEquipment.SelectionMode = System.Windows.Forms.DataGridViewSelectionMode.FullRowSelect;
			this.dgvEquipment.Size = new System.Drawing.Size(187, 215);
			this.dgvEquipment.TabIndex = 3;
			// 
			// ColEquipmentId
			// 
			this.ColEquipmentId.HeaderText = "Equipment Id";
			this.ColEquipmentId.Name = "ColEquipmentId";
			this.ColEquipmentId.ReadOnly = true;
			this.ColEquipmentId.Visible = false;
			// 
			// ColEquipmentName
			// 
			this.ColEquipmentName.AutoSizeMode = System.Windows.Forms.DataGridViewAutoSizeColumnMode.Fill;
			this.ColEquipmentName.HeaderText = "Equipment Name";
			this.ColEquipmentName.Name = "ColEquipmentName";
			this.ColEquipmentName.ReadOnly = true;
			// 
			// dgvEquimentDetail
			// 
			this.dgvEquimentDetail.AllowUserToAddRows = false;
			this.dgvEquimentDetail.AllowUserToDeleteRows = false;
			this.dgvEquimentDetail.AllowUserToResizeColumns = false;
			this.dgvEquimentDetail.AllowUserToResizeRows = false;
			this.dgvEquimentDetail.AutoSizeRowsMode = System.Windows.Forms.DataGridViewAutoSizeRowsMode.AllCells;
			this.dgvEquimentDetail.BackgroundColor = System.Drawing.Color.White;
			this.dgvEquimentDetail.ColumnHeadersHeightSizeMode = System.Windows.Forms.DataGridViewColumnHeadersHeightSizeMode.AutoSize;
			this.dgvEquimentDetail.Columns.AddRange(new System.Windows.Forms.DataGridViewColumn[] {
            this.ColIndex,
            this.ColCatalogue,
            this.ColDeviceName,
            this.ColNumber});
			this.dgvEquimentDetail.Dock = System.Windows.Forms.DockStyle.Fill;
			this.dgvEquimentDetail.EditMode = System.Windows.Forms.DataGridViewEditMode.EditOnEnter;
			this.dgvEquimentDetail.Location = new System.Drawing.Point(0, 0);
			this.dgvEquimentDetail.Name = "dgvEquimentDetail";
			this.dgvEquimentDetail.RowHeadersVisible = false;
			this.dgvEquimentDetail.ScrollBars = System.Windows.Forms.ScrollBars.None;
			this.dgvEquimentDetail.SelectionMode = System.Windows.Forms.DataGridViewSelectionMode.FullRowSelect;
			this.dgvEquimentDetail.Size = new System.Drawing.Size(419, 215);
			this.dgvEquimentDetail.TabIndex = 3;
			// 
			// ColIndex
			// 
			this.ColIndex.HeaderText = "Index";
			this.ColIndex.Name = "ColIndex";
			this.ColIndex.ReadOnly = true;
			this.ColIndex.Width = 60;
			// 
			// ColCatalogue
			// 
			this.ColCatalogue.HeaderText = "Catalogue";
			this.ColCatalogue.Name = "ColCatalogue";
			this.ColCatalogue.ReadOnly = true;
			this.ColCatalogue.Width = 140;
			// 
			// ColDeviceName
			// 
			this.ColDeviceName.HeaderText = "DeviceName";
			this.ColDeviceName.Name = "ColDeviceName";
			this.ColDeviceName.ReadOnly = true;
			this.ColDeviceName.Width = 140;
			// 
			// ColNumber
			// 
			this.ColNumber.AutoSizeMode = System.Windows.Forms.DataGridViewAutoSizeColumnMode.Fill;
			this.ColNumber.HeaderText = "Number";
			this.ColNumber.Name = "ColNumber";
			this.ColNumber.ReadOnly = true;
			// 
			// btnOk
			// 
			this.btnOk.Anchor = System.Windows.Forms.AnchorStyles.Bottom;
			this.btnOk.Location = new System.Drawing.Point(547, 317);
			this.btnOk.Name = "btnOk";
			this.btnOk.Size = new System.Drawing.Size(75, 29);
			this.btnOk.TabIndex = 6;
			this.btnOk.Text = "OK";
			this.btnOk.UseVisualStyleBackColor = true;
			this.btnOk.Click += new System.EventHandler(this.btnOk_Click);
			// 
			// btnAdd
			// 
			this.btnAdd.Anchor = System.Windows.Forms.AnchorStyles.Bottom;
			this.btnAdd.Location = new System.Drawing.Point(117, 317);
			this.btnAdd.Name = "btnAdd";
			this.btnAdd.Size = new System.Drawing.Size(75, 29);
			this.btnAdd.TabIndex = 5;
			this.btnAdd.Text = "Add";
			this.btnAdd.UseVisualStyleBackColor = true;
			this.btnAdd.Click += new System.EventHandler(this.btnAdd_Click);
			// 
			// txtFilter
			// 
			this.txtFilter.Location = new System.Drawing.Point(12, 62);
			this.txtFilter.Name = "txtFilter";
			this.txtFilter.Size = new System.Drawing.Size(186, 20);
			this.txtFilter.TabIndex = 4;
			this.txtFilter.TextChanged += new System.EventHandler(this.txtFilter_TextChanged);
			// 
			// label1
			// 
			this.label1.AutoSize = true;
			this.label1.Location = new System.Drawing.Point(9, 16);
			this.label1.Name = "label1";
			this.label1.Size = new System.Drawing.Size(65, 13);
			this.label1.TabIndex = 1;
			this.label1.Text = "Equipments:";
			// 
			// cbEquiqment
			// 
			this.cbEquiqment.DropDownStyle = System.Windows.Forms.ComboBoxStyle.DropDownList;
			this.cbEquiqment.FormattingEnabled = true;
			this.cbEquiqment.Location = new System.Drawing.Point(12, 35);
			this.cbEquiqment.Name = "cbEquiqment";
			this.cbEquiqment.Size = new System.Drawing.Size(186, 21);
			this.cbEquiqment.TabIndex = 0;
			this.cbEquiqment.SelectionChangeCommitted += new System.EventHandler(this.cbEquiqment_SelectionChangeCommitted);
			// 
			// tabPage1
			// 
			this.tabPage1.Controls.Add(this.button1);
			this.tabPage1.Controls.Add(this.label3);
			this.tabPage1.Controls.Add(this.lbxFoodInfo);
			this.tabPage1.Controls.Add(this.cmbCateringPackages);
			this.tabPage1.Controls.Add(this.label2);
			this.tabPage1.Location = new System.Drawing.Point(4, 22);
			this.tabPage1.Name = "tabPage1";
			this.tabPage1.Padding = new System.Windows.Forms.Padding(3);
			this.tabPage1.Size = new System.Drawing.Size(625, 353);
			this.tabPage1.TabIndex = 0;
			this.tabPage1.Text = "Catering";
			this.tabPage1.UseVisualStyleBackColor = true;
			// 
			// button1
			// 
			this.button1.Location = new System.Drawing.Point(240, 53);
			this.button1.Name = "button1";
			this.button1.Size = new System.Drawing.Size(60, 23);
			this.button1.TabIndex = 4;
			this.button1.Text = "Others";
			this.button1.UseVisualStyleBackColor = true;
			// 
			// label3
			// 
			this.label3.AutoSize = true;
			this.label3.Location = new System.Drawing.Point(24, 127);
			this.label3.Name = "label3";
			this.label3.Size = new System.Drawing.Size(89, 13);
			this.label3.TabIndex = 3;
			this.label3.Text = "Food Information:";
			// 
			// lbxFoodInfo
			// 
			this.lbxFoodInfo.FormattingEnabled = true;
			this.lbxFoodInfo.Location = new System.Drawing.Point(24, 143);
			this.lbxFoodInfo.Name = "lbxFoodInfo";
			this.lbxFoodInfo.Size = new System.Drawing.Size(273, 186);
			this.lbxFoodInfo.TabIndex = 2;
			// 
			// cmbCateringPackages
			// 
			this.cmbCateringPackages.DropDownStyle = System.Windows.Forms.ComboBoxStyle.DropDownList;
			this.cmbCateringPackages.FormattingEnabled = true;
			this.cmbCateringPackages.Location = new System.Drawing.Point(24, 53);
			this.cmbCateringPackages.Name = "cmbCateringPackages";
			this.cmbCateringPackages.Size = new System.Drawing.Size(210, 21);
			this.cmbCateringPackages.TabIndex = 1;
			// 
			// label2
			// 
			this.label2.AutoSize = true;
			this.label2.Location = new System.Drawing.Point(21, 26);
			this.label2.Name = "label2";
			this.label2.Size = new System.Drawing.Size(100, 13);
			this.label2.TabIndex = 0;
			this.label2.Text = "Catering Packages:";
			// 
			// EquipmentAndCateringPane
			// 
			this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 13F);
			this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
			this.Controls.Add(this.tabCatering);
			this.Name = "EquipmentAndCateringPane";
			this.Size = new System.Drawing.Size(633, 379);
			this.Load += new System.EventHandler(this.EquipmentAndCateringPane_Load);
			this.tabCatering.ResumeLayout(false);
			this.tabEquipment.ResumeLayout(false);
			this.tabEquipment.PerformLayout();
			this.splitContainer1.Panel1.ResumeLayout(false);
			this.splitContainer1.Panel2.ResumeLayout(false);
			((System.ComponentModel.ISupportInitialize)(this.splitContainer1)).EndInit();
			this.splitContainer1.ResumeLayout(false);
			((System.ComponentModel.ISupportInitialize)(this.dgvEquipment)).EndInit();
			((System.ComponentModel.ISupportInitialize)(this.dgvEquimentDetail)).EndInit();
			this.tabPage1.ResumeLayout(false);
			this.tabPage1.PerformLayout();
			this.ResumeLayout(false);

		}

		#endregion

		private System.Windows.Forms.TabControl tabCatering;
		private System.Windows.Forms.TabPage tabPage1;
		private System.Windows.Forms.Button button1;
		private System.Windows.Forms.Label label3;
		private System.Windows.Forms.ListBox lbxFoodInfo;
		private System.Windows.Forms.ComboBox cmbCateringPackages;
		private System.Windows.Forms.Label label2;
		private System.Windows.Forms.TabPage tabEquipment;
		private System.Windows.Forms.Button btnAdd;
		private System.Windows.Forms.TextBox txtFilter;
		private System.Windows.Forms.Label label1;
		private System.Windows.Forms.ComboBox cbEquiqment;
		private System.Windows.Forms.Button btnOk;
		private System.Windows.Forms.SplitContainer splitContainer1;
		private System.Windows.Forms.DataGridView dgvEquipment;
		private System.Windows.Forms.DataGridView dgvEquimentDetail;
		private System.Windows.Forms.Button btnRemove;
		private System.Windows.Forms.DataGridViewTextBoxColumn ColIndex;
		private System.Windows.Forms.DataGridViewTextBoxColumn ColCatalogue;
		private System.Windows.Forms.DataGridViewTextBoxColumn ColDeviceName;
		private System.Windows.Forms.DataGridViewTextBoxColumn ColNumber;
		private System.Windows.Forms.DataGridViewTextBoxColumn ColEquipmentId;
		private System.Windows.Forms.DataGridViewTextBoxColumn ColEquipmentName;

	}
}
