const db = require('../config/db');
const xlsx = require('xlsx');

// Resilient In-Memory Occupants Cache
// Ensures the web dashboard and autonomous emergency voice dispatch NEVER wait on slow/offline cloud DB
let occupantsCache = [
  { id: 1, name: 'Sushil Sahoo', phone: '+918260507345', building_id: 'Building 1', room_number: 'Flat 402', floor: 4, status: 'Inside Building', relative_name: 'sushil', relative_phone: '+918260507345', relative_relation: 'Father' },
  { id: 5, name: 'muktesh', phone: '+917077618445', building_id: 'Building 1', room_number: '56', floor: 1, status: 'Inside Building', relative_name: 'muktesh', relative_phone: '+917077618445', relative_relation: 'Family' },
  { id: 8, name: 'mahaprasad', phone: '+919337597442', building_id: 'Building 1', room_number: '67', floor: 1, status: 'Inside Building', relative_name: 'mahaprasad', relative_phone: '+919337597442', relative_relation: 'Family' }
];

function computeStats(list) {
  return {
    total: list.length,
    inside: list.filter(o => o.status === 'Inside Building').length,
    evacuated: list.filter(o => o.status === 'Evacuated / Safe').length,
    b1Count: list.filter(o => o.building_id === 'Building 1').length,
    b2Count: list.filter(o => o.building_id === 'Building 2').length,
  };
}

// Background Sync from PostgreSQL
async function syncFromDb() {
  try {
    const res = await db.query('SELECT * FROM building_occupants ORDER BY id ASC');
    if (res.rows && res.rows.length > 0) {
      occupantsCache = res.rows;
      console.log(`[Occupant Cache] Synchronized ${occupantsCache.length} occupants from PostgreSQL.`);
    }
  } catch (err) {
    console.warn('[Occupant Cache] DB sync notice (using cached data):', err.message);
  }
}
// Initial sync
syncFromDb();

// Export cache for direct access by emergency broadcast
exports.getCachedOccupants = () => occupantsCache;

// 1. Get all occupants with optional filtering & summary counts
exports.getAllOccupants = async (req, res) => {
  const { building, status, search } = req.query;

  // Try DB query with a quick timeout fallback
  try {
    let query = 'SELECT * FROM building_occupants WHERE 1=1';
    const params = [];

    if (building && building !== 'All') {
      params.push(building);
      query += ` AND building_id = $${params.length}`;
    }

    if (status && status !== 'All') {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }

    if (search) {
      params.push(`%${search.trim()}%`);
      query += ` AND (name ILIKE $${params.length} OR room_number ILIKE $${params.length} OR phone ILIKE $${params.length} OR relative_name ILIKE $${params.length})`;
    }

    query += ' ORDER BY id ASC';

    // Race DB query with 2.5s fallback to prevent frontend hanging
    const dbPromise = Promise.all([
      db.query(query, params),
      db.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'Inside Building' THEN 1 END) as inside,
          COUNT(CASE WHEN status = 'Evacuated / Safe' THEN 1 END) as evacuated,
          COUNT(CASE WHEN building_id = 'Building 1' THEN 1 END) as b1_count,
          COUNT(CASE WHEN building_id = 'Building 2' THEN 1 END) as b2_count
        FROM building_occupants
      `)
    ]);

    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('DB query timeout')), 2500));
    const [result, statsResult] = await Promise.race([dbPromise, timeoutPromise]);

    const occupants = result.rows;
    occupantsCache = occupants; // keep fresh
    const stats = statsResult.rows[0];

    return res.json({
      occupants,
      stats: {
        total: parseInt(stats.total || 0),
        inside: parseInt(stats.inside || 0),
        evacuated: parseInt(stats.evacuated || 0),
        b1Count: parseInt(stats.b1_count || 0),
        b2Count: parseInt(stats.b2_count || 0),
      },
    });
  } catch (err) {
    console.warn('[getAllOccupants] Using resilient in-memory cache:', err.message);
    
    // Filter from memory
    let filtered = [...occupantsCache];
    if (building && building !== 'All') {
      filtered = filtered.filter(o => o.building_id === building);
    }
    if (status && status !== 'All') {
      filtered = filtered.filter(o => o.status === status);
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(o =>
        (o.name && o.name.toLowerCase().includes(q)) ||
        (o.room_number && o.room_number.toLowerCase().includes(q)) ||
        (o.phone && o.phone.toLowerCase().includes(q)) ||
        (o.relative_name && o.relative_name.toLowerCase().includes(q))
      );
    }

    return res.json({
      occupants: filtered,
      stats: computeStats(occupantsCache),
    });
  }
};


// 2. Create single occupant manually
exports.createOccupant = async (req, res) => {
  try {
    const {
      name,
      phone,
      building_id = 'Building 1',
      room_number = 'Room 101',
      floor = 1,
      status = 'Inside Building',
      relative_name = '',
      relative_phone = '',
      relative_relation = 'Family',
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Occupant Name and Phone Number are required.' });
    }

    const query = `
      INSERT INTO building_occupants 
      (name, phone, building_id, room_number, floor, status, relative_name, relative_phone, relative_relation, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING *;
    `;
    const values = [name.trim(), phone.trim(), building_id, room_number.trim(), parseInt(floor) || 1, status, relative_name.trim(), relative_phone.trim(), relative_relation.trim()];

    const result = await db.query(query, values);
    const newOcc = result.rows[0];
    occupantsCache.push(newOcc);
    res.status(201).json({ status: 'success', occupant: newOcc });
  } catch (err) {
    console.error('Error creating occupant:', err);
    res.status(500).json({ error: 'Failed to save occupant' });
  }
};

// 3. Update existing occupant
exports.updateOccupant = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      phone,
      building_id,
      room_number,
      floor,
      status,
      relative_name,
      relative_phone,
      relative_relation,
    } = req.body;

    const query = `
      UPDATE building_occupants SET
        name = COALESCE($1, name),
        phone = COALESCE($2, phone),
        building_id = COALESCE($3, building_id),
        room_number = COALESCE($4, room_number),
        floor = COALESCE($5, floor),
        status = COALESCE($6, status),
        relative_name = COALESCE($7, relative_name),
        relative_phone = COALESCE($8, relative_phone),
        relative_relation = COALESCE($9, relative_relation),
        updated_at = NOW()
      WHERE id = $10
      RETURNING *;
    `;
    const values = [
      name ? name.trim() : null,
      phone ? phone.trim() : null,
      building_id,
      room_number ? room_number.trim() : null,
      floor ? parseInt(floor) : null,
      status,
      relative_name !== undefined ? relative_name.trim() : null,
      relative_phone !== undefined ? relative_phone.trim() : null,
      relative_relation !== undefined ? relative_relation.trim() : null,
      id,
    ];

    const result = await db.query(query, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Occupant not found' });
    }

    const updated = result.rows[0];
    occupantsCache = occupantsCache.map(o => o.id === parseInt(id) ? updated : o);
    res.json({ status: 'success', occupant: updated });
  } catch (err) {
    console.error('Error updating occupant:', err);
    res.status(500).json({ error: 'Failed to update occupant' });
  }
};

// 4. Quick Toggle Evacuation Status ("Inside Building" <-> "Evacuated / Safe")
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) return res.status(400).json({ error: 'Status is required' });

    // Update in-memory cache immediately
    occupantsCache = occupantsCache.map(o => o.id === parseInt(id) ? { ...o, status } : o);

    const result = await db.query(
      'UPDATE building_occupants SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Occupant not found' });
    }

    res.json({ status: 'success', occupant: result.rows[0] });
  } catch (err) {
    console.error('Error toggling status:', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
};

// 5. Delete occupant
exports.deleteOccupant = async (req, res) => {
  try {
    const { id } = req.params;
    occupantsCache = occupantsCache.filter(o => o.id !== parseInt(id));

    const result = await db.query('DELETE FROM building_occupants WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Occupant not found' });
    }

    res.json({ status: 'success', message: 'Occupant removed from directory' });
  } catch (err) {
    console.error('Error deleting occupant:', err);
    res.status(500).json({ error: 'Failed to delete occupant' });
  }
};

// 6. Bulk Import via Excel (.xlsx, .xls) or CSV
exports.uploadExcel = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No Excel or CSV file uploaded.' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    if (!rows || rows.length === 0) {
      return res.status(400).json({ error: 'The uploaded spreadsheet is empty.' });
    }

    let insertedCount = 0;
    const errors = [];

    // Helper: fuzzy match column names
    const getCol = (row, ...aliases) => {
      for (const k of Object.keys(row)) {
        const cleanK = k.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const a of aliases) {
          const cleanA = a.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (cleanK === cleanA) return String(row[k]).trim();
        }
      }
      return '';
    };

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const name = getCol(r, 'Name', 'Resident Name', 'Occupant Name', 'Full Name');
      const phone = getCol(r, 'Phone', 'Mobile', 'Contact', 'Phone Number', 'Mobile Number');
      const building = getCol(r, 'Building', 'Building ID', 'Tower') || 'Building 1';
      const room = getCol(r, 'Room', 'Room Number', 'Flat', 'Flat No', 'Unit') || 'Room 101';
      const floor = parseInt(getCol(r, 'Floor')) || 1;
      const statusRaw = getCol(r, 'Status', 'Evacuation Status') || 'Inside Building';
      const status = statusRaw.toLowerCase().includes('safe') || statusRaw.toLowerCase().includes('evac')
        ? 'Evacuated / Safe'
        : 'Inside Building';

      const relativeName = getCol(r, 'Relative Name', 'Family Name', 'Emergency Contact Name', 'Kin Name');
      const relativePhone = getCol(r, 'Relative Phone', 'Family Phone', 'Emergency Contact Phone', 'Kin Phone');
      const relativeRelation = getCol(r, 'Relative Relation', 'Relation', 'Relationship') || 'Family';

      if (!name || !phone) {
        errors.push(`Row ${i + 2}: Missing required Name or Phone`);
        continue;
      }

      await db.query(`
        INSERT INTO building_occupants 
        (name, phone, building_id, room_number, floor, status, relative_name, relative_phone, relative_relation, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW());
      `, [name, phone, building, room, floor, status, relativeName, relativePhone, relativeRelation]);

      insertedCount++;
    }

    res.json({
      status: 'success',
      insertedCount,
      totalRows: rows.length,
      errors,
      message: `Successfully imported ${insertedCount} occupants into the emergency directory!`,
    });
  } catch (err) {
    console.error('Error importing Excel:', err);
    res.status(500).json({ error: 'Failed to parse and import Excel file: ' + err.message });
  }
};

// 7. Download Sample Excel / CSV Template
exports.getTemplate = (req, res) => {
  const sampleData = [
    {
      'Full Name': 'Sushil Sahoo',
      'Phone Number': '+919876543210',
      'Building': 'Building 1',
      'Room/Flat': 'Flat 402',
      'Floor': 4,
      'Status': 'Inside Building',
      'Relative Name': 'Ramesh Sahoo',
      'Relative Phone': '+919123456789',
      'Relationship': 'Father',
    },
    {
      'Full Name': 'Ananya Sharma',
      'Phone Number': '+919811223344',
      'Building': 'Building 1',
      'Room/Flat': 'Flat 201',
      'Floor': 2,
      'Status': 'Inside Building',
      'Relative Name': 'Vikram Sharma',
      'Relative Phone': '+919899001122',
      'Relationship': 'Spouse',
    },
    {
      'Full Name': 'Rajesh Kumar',
      'Phone Number': '+919765432100',
      'Building': 'Building 2',
      'Room/Flat': 'Suite 105',
      'Floor': 1,
      'Status': 'Evacuated / Safe',
      'Relative Name': 'Pooja Kumar',
      'Relative Phone': '+919755443322',
      'Relationship': 'Sister',
    },
  ];

  const ws = xlsx.utils.json_to_sheet(sampleData);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'Occupants_Template');

  const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="SHM_Occupants_Template.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
};

// 8. Export Current Directory as Excel (.xlsx)
exports.exportOccupants = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM building_occupants ORDER BY building_id, floor, room_number');
    const occupants = result.rows.map(o => ({
      'ID': o.id,
      'Full Name': o.name,
      'Phone Number': o.phone,
      'Building': o.building_id,
      'Room/Flat': o.room_number,
      'Floor': o.floor,
      'Status': o.status,
      'Relative Name': o.relative_name || '',
      'Relative Phone': o.relative_phone || '',
      'Relationship': o.relative_relation || '',
      'Registered At': o.created_at ? new Date(o.created_at).toLocaleString() : '',
    }));

    const ws = xlsx.utils.json_to_sheet(occupants);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Occupants');

    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', `attachment; filename="SHM_Occupants_Directory_${Date.now()}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Failed to export occupants directory' });
  }
};

