/**
 * seed.js
 * * A helper script to populate the database with sample data for development and testing.
 * This script connects directly to the SQLite database to ensure a clean and predictable state.
 *
 * To run this script:
 * 1. Make sure you have run `npm install`.
 * 2. From the root of your project, run `npm run seed`.
 */
import { v4 as uuid } from 'uuid';
import { initializeDatabase } from './database.js';
import { getShirtSize } from './utils.js';

/**
 * Main function to orchestrate the seeding process.
 */
async function seedDatabase() {
  console.log('INFO: Starting database seeding process...');
  const db = await initializeDatabase();

  try {
    // --- Clear Existing Data ---
    console.log('INFO: Clearing existing data from tables...');
    await db.run('DELETE FROM initiatives');
    await db.run('DELETE FROM estimation_factors');
    await db.run('DELETE FROM resource_types');
    console.log('INFO: Existing data cleared.');

    // --- Seed Resource Types ---
    console.log('INFO: Seeding resource types...');
    const resourceTypes = [
      { id: uuid(), name: 'Frontend Dev', description: 'Handles user interface and client-side logic.' },
      { id: uuid(), name: 'Backend Dev', description: 'Handles server-side logic, APIs, and database interactions.' },
      { id: uuid(), name: 'QA Engineer', description: 'Responsible for quality assurance and testing.' },
      { id: uuid(), name: 'Project Manager', description: 'Oversees project planning, execution, and communication.' },
      { id: uuid(), name: 'DevOps', description: 'Manages infrastructure, deployment, and CI/CD pipelines.' },
    ];
    for (const rt of resourceTypes) {
      await db.run('INSERT INTO resource_types (id, name, description) VALUES (?, ?, ?)', [rt.id, rt.name, rt.description]);
    }
    console.log(`INFO: Seeded ${resourceTypes.length} resource types.`);

    // --- Seed Estimation Factors ---
    console.log('INFO: Seeding estimation factors...');
    const now = new Date().toISOString();
    const factors = [
      {
        name: 'Simple UI Component',
        description: 'A basic, non-interactive UI element like a button or styled text.',
        hours: { [resourceTypes.find(r => r.name === 'Frontend Dev').id]: 8 }
      },
      {
        name: 'Complex UI Component',
        description: 'An interactive UI element with state, like a data grid or a form with validation.',
        hours: { [resourceTypes.find(r => r.name === 'Frontend Dev').id]: 40 }
      },
      {
        name: 'Simple API Endpoint',
        description: 'A standard CRUD endpoint with basic validation.',
        hours: { [resourceTypes.find(r => r.name === 'Backend Dev').id]: 16 }
      },
      {
        name: 'Complex API w/ Integration',
        description: 'An endpoint that integrates with a third-party service or performs complex data aggregation.',
        hours: { [resourceTypes.find(r => r.name === 'Backend Dev').id]: 60 }
      },
      {
        name: 'Basic Test Plan',
        description: 'Writing and executing a test plan for a small feature.',
        hours: { [resourceTypes.find(r => r.name === 'QA Engineer').id]: 8 }
      },
      {
        name: 'Full E2E Test Suite',
        description: 'Developing an end-to-end automated test suite for a major feature.',
        hours: { [resourceTypes.find(r => r.name === 'QA Engineer').id]: 40 }
      },
      {
        name: 'Project Kickoff & Planning',
        description: 'Initial project setup, requirements gathering, and timeline planning.',
        hours: { [resourceTypes.find(r => r.name === 'Project Manager').id]: 16 }
      },
      {
        name: 'CI/CD Pipeline Setup',
        description: 'Configuring a new continuous integration and deployment pipeline.',
        hours: { [resourceTypes.find(r => r.name === 'DevOps').id]: 24 }
      }
    ];

    const seededFactors = [];
    for (const f of factors) {
      const newId = uuid();
      await db.run(
        'INSERT INTO estimation_factors (id, name, description, hours_per_resource_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [newId, f.name, f.description, JSON.stringify(f.hours), now, now]
      );
      seededFactors.push({ id: newId, ...f });
    }
    console.log(`INFO: Seeded ${seededFactors.length} estimation factors.`);

    // --- Seed Initiatives ---
    console.log('INFO: Seeding initiatives...');
    const initiatives = [
      {
        name: 'New Marketing Website',
        custom_id: 'PROJ-001',
        description: 'A complete overhaul of the public-facing marketing website.',
        priority: 'High',
        priority_num: 1,
        status: 'To Do',
        start_date: '2025-09-01',
        end_date: '2025-12-15',
        scope: '- New design system implementation\n- CMS integration\n- SEO optimization',
        out_of_scope: '- E-commerce functionality\n- Customer login portal',
        factors: [
          { name: 'Complex UI Component', quantity: 3 },
          { name: 'Simple API Endpoint', quantity: 2 },
          { name: 'Full E2E Test Suite', quantity: 1 },
          { name: 'Project Kickoff & Planning', quantity: 1 }
        ]
      },
      {
        name: 'Q4 Analytics Dashboard',
        custom_id: 'PROJ-002',
        description: 'Build a new dashboard for the sales team to track quarterly performance.',
        priority: 'Medium',
        priority_num: 3,
        status: 'Proposal',
        start_date: '2025-10-01',
        end_date: '2025-11-30',
        scope: '- Integration with Salesforce API\n- Key metrics visualization (revenue, leads, conversion rate)',
        out_of_scope: '- Predictive analytics features\n- Mobile application version',
        factors: [
          { name: 'Complex UI Component', quantity: 1 },
          { name: 'Complex API w/ Integration', quantity: 1 },
          { name: 'Basic Test Plan', quantity: 2 }
        ]
      },
      {
        name: 'API Security Audit',
        custom_id: 'PROJ-003',
        description: 'Perform a full security audit on all public-facing APIs.',
        priority: 'High',
        priority_num: 2,
        status: 'Accepted',
        factors: [] // Example with no factors
      }
    ];

    for (const init of initiatives) {
      const selected_factors = init.factors.map(f => {
        const fullFactor = seededFactors.find(sf => sf.name === f.name);
        return {
          factorId: fullFactor.id,
          quantity: f.quantity,
          name: fullFactor.name,
          hoursPerResourceType: fullFactor.hours
        };
      });

      // Replicate business logic from the API to calculate hours and shirt size
      let computedHours = 0;
      selected_factors.forEach(sf => {
        const totalFactorHours = Object.values(sf.hoursPerResourceType).reduce((sum, h) => sum + h, 0);
        computedHours += totalFactorHours * sf.quantity;
      });
      const shirtSize = await getShirtSize(db, computedHours);

      await db.run(
        `INSERT INTO initiatives (name, custom_id, description, priority, priority_num, status, classification, scope, out_of_scope, selected_factors, computed_hours, shirt_size, start_date, end_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          init.name, init.custom_id, init.description, init.priority, init.priority_num, init.status,
          'Internal', init.scope, init.out_of_scope,
          JSON.stringify(selected_factors),
          computedHours, shirtSize,
          init.start_date || null, init.end_date || null,
          now, now
        ]
      );
    }
    console.log(`INFO: Seeded ${initiatives.length} initiatives.`);

  } catch (error) {
    console.error('ERROR: An error occurred during the seeding process:', error);
    // If we are in a transaction, we should roll back
    // await db.run('ROLLBACK'); 
  } finally {
    await db.close();
    console.log('INFO: Seeding process finished. Database connection closed.');
  }
}

// Execute the seeding function
seedDatabase();
