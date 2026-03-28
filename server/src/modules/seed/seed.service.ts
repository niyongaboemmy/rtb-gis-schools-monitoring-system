import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Role } from '../roles/entities/role.entity';
import { AccessLevel } from '../access-levels/entities/access-level.entity';
import { DefaultRolePermissions } from '../../common/constants/permissions.constant';
import {
  School,
  SchoolType,
  SchoolStatus,
  PriorityLevel,
} from '../schools/entities/school.entity';
import { FacilityEntity } from '../schools/entities/facility.entity';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    @InjectRepository(School) private schoolRepo: Repository<School>,
    @InjectRepository(FacilityEntity)
    private facilityRepo: Repository<FacilityEntity>,
    @InjectRepository(AccessLevel)
    private accessLevelRepo: Repository<AccessLevel>,
  ) {}

  async onModuleInit() {
    await this.seedAccessLevels();
    await this.seedAdminUser();
    await this.seedSampleSchools();
    await this.seedFacilities();
  }

  private async seedAccessLevels() {
    const LEVELS = ['National', 'Province', 'District', 'Sector', 'School'];
    const levelMap: Record<string, AccessLevel> = {};

    for (const name of LEVELS) {
      let level = await this.accessLevelRepo.findOne({ where: { name } });
      if (!level) {
        level = await this.accessLevelRepo.save(
          this.accessLevelRepo.create({ name }),
        );
        this.logger.log(`✅ Created access level: ${name}`);
      }
      levelMap[name] = level;
    }

    // Assign default access levels to system roles
    const roleDefaults: Record<string, string> = {
      super_admin: 'National',
      admin: 'Province',
      viewer: 'School',
    };

    for (const [roleName, levelName] of Object.entries(roleDefaults)) {
      const role = await this.roleRepo.findOne({
        where: { name: roleName },
        relations: ['accessLevel'],
      });
      if (role && !role.accessLevel) {
        role.accessLevel = levelMap[levelName];
        await this.roleRepo.save(role);
        this.logger.log(
          `✅ Assigned access level "${levelName}" to role: ${roleName}`,
        );
      }
    }
  }

  private async seedAdminUser() {
    for (const [roleName, permissions] of Object.entries(
      DefaultRolePermissions,
    )) {
      const existingRole = await this.roleRepo.findOne({
        where: { name: roleName },
      });
      if (!existingRole) {
        await this.roleRepo.save(
          this.roleRepo.create({ name: roleName, permissions }),
        );
        this.logger.log(`✅ Created role: ${roleName}`);
      } else {
        // Sync permissions for all system roles to ensure they have latest capabilities
        existingRole.permissions = permissions;
        await this.roleRepo.save(existingRole);
        this.logger.log(`✅ Synced permissions for role: ${roleName}`);
      }
    }

    const superAdminRole = await this.roleRepo.findOne({
      where: { name: 'super_admin' },
    });
    this.logger.log(
      `Checking super_admin role status: ${superAdminRole ? 'FOUND' : 'MISSING'}`,
    );

    const adminUser = await this.userRepo.findOne({
      where: { email: 'admin@rtb.gov.rw' },
      relations: ['role'],
    });

    if (adminUser) {
      this.logger.log(
        `Existing admin user status: FOUND. Current role: ${adminUser.role ? adminUser.role.name : 'NULL'}`,
      );
      // Ensure existing admin has the super_admin role linked (important for migration from enum to entity)
      if (!adminUser.role || adminUser.role.name !== 'super_admin') {
        if (superAdminRole) {
          adminUser.role = superAdminRole;
          await this.userRepo.save(adminUser);
          this.logger.log(
            '✅ Updated existing admin user link to super_admin role',
          );
        } else {
          this.logger.error(
            '❌ CRITICAL: Cannot link admin user because super_admin role was not found',
          );
        }
      }
    } else if (superAdminRole) {
      const admin = this.userRepo.create({
        firstName: 'System',
        lastName: 'Administrator',
        email: 'admin@rtb.gov.rw',
        password: 'Admin@123',
        role: superAdminRole as any,
        isActive: true,
      });
      await this.userRepo.save(admin);
      this.logger.log('✅ New admin user seeded: admin@rtb.gov.rw / Admin@123');
    }
  }

  private async seedSampleSchools() {
    const count = await this.schoolRepo.count();
    if (count > 0) return;

    const schools = [
      {
        code: 'TSS-KGL-001',
        name: 'Kigali Technical Secondary School',
        type: SchoolType.TSS,
        status: SchoolStatus.ACTIVE,
        province: 'Kigali City',
        district: 'Gasabo',
        sector: 'Kagugu',
        latitude: -1.9354,
        longitude: 30.1089,
        establishedYear: 1985,
        totalStudents: 1200,
        totalTeachers: 68,
        priorityLevel: PriorityLevel.HIGH,
        overallScore: 62,
        description:
          'One of the largest TSS in Kigali with engineering and ICT programs',
      },
      {
        code: 'VTC-EAS-001',
        name: 'Nyamirama Vocational Training Center',
        type: SchoolType.VTC,
        status: SchoolStatus.ACTIVE,
        province: 'Eastern Province',
        district: 'Kayonza',
        sector: 'Kabare',
        latitude: -1.9441,
        longitude: 30.0619,
        establishedYear: 1998,
        totalStudents: 450,
        totalTeachers: 28,
        priorityLevel: PriorityLevel.CRITICAL,
        overallScore: 82,
        description:
          'Rural VTC requiring urgent renovation of main workshop building',
      },
      {
        code: 'TSS-NOR-001',
        name: 'Byumba Technical Secondary School',
        type: SchoolType.TSS,
        status: SchoolStatus.ACTIVE,
        province: 'Northern Province',
        district: 'Gicumbi',
        sector: 'Byumba',
        latitude: -1.5761,
        longitude: 30.067,
        establishedYear: 1976,
        totalStudents: 890,
        totalTeachers: 52,
        priorityLevel: PriorityLevel.CRITICAL,
        overallScore: 88,
        description:
          'Oldest TSS in Northern Province, buildings exceeding 40-year lifespan',
      },
      {
        code: 'TSS-SOU-001',
        name: 'Huye Technical Secondary School',
        type: SchoolType.TSS,
        status: SchoolStatus.ACTIVE,
        province: 'Southern Province',
        district: 'Huye',
        sector: 'Ngoma',
        latitude: -2.596,
        longitude: 29.74,
        establishedYear: 1992,
        totalStudents: 760,
        totalTeachers: 45,
        priorityLevel: PriorityLevel.MEDIUM,
        overallScore: 48,
        description:
          'Medium priority school with partial renovation completed in 2019',
      },
      {
        code: 'TSS-WES-001',
        name: 'Rubavu Technical Secondary School',
        type: SchoolType.TSS,
        status: SchoolStatus.ACTIVE,
        province: 'Western Province',
        district: 'Rubavu',
        sector: 'Rubavu',
        latitude: -1.6775,
        longitude: 29.346,
        establishedYear: 2005,
        totalStudents: 650,
        totalTeachers: 38,
        priorityLevel: PriorityLevel.LOW,
        overallScore: 25,
        description:
          'Newer school with good structural integrity and modern facilities',
      },
      {
        code: 'VTC-KGL-002',
        name: 'Kicukiro VTC',
        type: SchoolType.VTC,
        status: SchoolStatus.ACTIVE,
        province: 'Kigali City',
        district: 'Kicukiro',
        sector: 'Niboye',
        latitude: -1.9769,
        longitude: 30.0852,
        establishedYear: 2001,
        totalStudents: 380,
        totalTeachers: 24,
        priorityLevel: PriorityLevel.HIGH,
        overallScore: 67,
        description:
          'Urban VTC focusing on construction and electricity programs',
      },
      {
        code: 'INT-EAS-002',
        name: 'Rwamagana Integrated Polytechnic',
        type: SchoolType.INTEGRATED,
        status: SchoolStatus.UNDER_RENOVATION,
        province: 'Eastern Province',
        district: 'Rwamagana',
        sector: 'Rwamagana',
        latitude: -1.9487,
        longitude: 30.4352,
        establishedYear: 2010,
        totalStudents: 920,
        totalTeachers: 58,
        priorityLevel: PriorityLevel.MEDIUM,
        overallScore: 42,
        description:
          'Currently undergoing Phase 2 renovation of science laboratories',
      },
      {
        code: 'TSS-NOR-002',
        name: 'Musanze TSS',
        type: SchoolType.TSS,
        status: SchoolStatus.ACTIVE,
        province: 'Northern Province',
        district: 'Musanze',
        sector: 'Muhoza',
        latitude: -1.5014,
        longitude: 29.6348,
        establishedYear: 1989,
        totalStudents: 1050,
        totalTeachers: 60,
        priorityLevel: PriorityLevel.HIGH,
        overallScore: 58,
        description:
          'Highland TSS serving Volcanoes National Park region communities',
      },
    ];

    for (const s of schools) {
      await this.schoolRepo.save(this.schoolRepo.create(s));
    }
    this.logger.log(`✅ Seeded ${schools.length} sample schools`);
  }

  private async seedFacilities() {
    const facilities = [
      {
        facilityId: 'administration',
        title: 'Administration Office',
        items: [
          {
            id: 'admin_visitor',
            label: 'Welcoming visitor space',
            tags: ['Structure'],
            issueCategories: [
              'Broken chairs',
              'Damaged flooring',
              'Poor lighting',
              'Peeling paint',
              'Broken door',
            ],
          },
          {
            id: 'admin_offices',
            label: 'Private offices available',
            tags: ['Structure'],
            issueCategories: [
              'AC malfunction',
              'Broken desks/chairs',
              'Door lock failure',
              'Window crack',
              'Wall damage',
            ],
          },
          {
            id: 'admin_washroom',
            label: 'Accessible washrooms',
            tags: ['Sanitation', 'Accessibility'],
            issueCategories: [
              'Toilet clog',
              'Leaking tap',
              'Broken flush',
              'No mirror',
              'Hygiene issue',
            ],
          },
          {
            id: 'admin_lighting',
            label: 'LED lighting',
            tags: ['Environment'],
            issueCategories: [
              'Flickering lights',
              'Dead bulbs',
              'Broken switch',
              'Exposed wiring',
            ],
          },
          {
            id: 'admin_ict',
            label: 'Adaptive ICT facilities',
            tags: ['Accessibility'],
            issueCategories: [
              'Internet down',
              'PC hardware failure',
              'Printer jam',
              'Cable damage',
            ],
          },
          {
            id: 'admin_waste',
            label: 'Waste collection for recycling',
            tags: ['Environment'],
            issueCategories: [
              'Bin overflow',
              'Smell issue',
              'Missing bins',
              'Broken bin lid',
            ],
          },
          {
            id: 'admin_fire',
            label: 'Fire protection',
            tags: ['Safety'],
            issueCategories: [
              'Expired extinguisher',
              'Damaged detector',
              'Missing signage',
              'Access blocked',
            ],
          },
        ],
      },
      {
        facilityId: 'classroom',
        title: 'Classrooms',
        items: [
          {
            id: 'class_structure',
            label: 'Structural walls, roof & floor (weather-tight)',
            tags: ['Structure'],
            issueCategories: [
              'Wall cracks',
              'Roof leak',
              'Floor holes',
              'Peeling paint',
              'Damp walls',
            ],
          },
          {
            id: 'class_doors',
            label: '≥2 outward-opening doors, 5m apart',
            tags: ['Safety', 'Structure'],
            issueCategories: [
              'Broken hinge',
              'Missing lock',
              'Door stuck',
              'Damaged panel',
              'Handle loose',
            ],
          },
          {
            id: 'class_windows',
            label: 'Windows for natural light (≥25%)',
            tags: ['Environment', 'Structure'],
            issueCategories: [
              'Broken glass',
              'Stuck frame',
              'No latch',
              'Water leakage',
              'Rattling',
            ],
          },
          {
            id: 'class_ventilation',
            label: 'Natural ventilation / airflow',
            tags: ['Environment'],
            issueCategories: [
              'Blocked vents',
              'Stale air',
              'Fan failure',
              'Louver damage',
            ],
          },
          {
            id: 'class_sound',
            label: 'Sound insulation',
            tags: ['Structure'],
            issueCategories: ['Echo issues', 'Outside noise', 'Ceiling damage'],
          },
          {
            id: 'class_access',
            label: 'Interior circulation space',
            tags: ['Accessibility'],
            issueCategories: ['Obstructions', 'Narrow paths', 'Uneven floor'],
          },
          {
            id: 'class_fire',
            label: 'Fire extinguisher (1×12kg per 3 rooms)',
            tags: ['Safety'],
            issueCategories: [
              'Expired/Empty',
              'Missing',
              'Blocked access',
              'No pressure',
            ],
          },
          {
            id: 'class_lighting',
            label: 'LED or natural lighting system',
            tags: ['Environment'],
            issueCategories: [
              'Flickering lights',
              'Dead bulbs',
              'Exposed wiring',
              'Broken switch',
            ],
          },
        ],
      },
      {
        facilityId: 'smart_classroom',
        title: 'Smart Classroom',
        items: [
          {
            id: 'smart_ict',
            label: 'IT office and adaptive ICT facilities',
            tags: ['Accessibility'],
            issueCategories: [
              'PC hardware failure',
              'Network downtime',
              'Damaged cables',
              'Projector malfunction',
            ],
          },
          {
            id: 'smart_lighting',
            label: 'LED lighting',
            tags: ['Environment'],
            issueCategories: ['Flickering', 'Dark zones', 'Switch broken'],
          },
          {
            id: 'smart_ventilation',
            label: 'Natural ventilation',
            tags: ['Environment'],
            issueCategories: ['Dust buildup', 'Obstruction', 'Broken handle'],
          },
          {
            id: 'smart_furniture',
            label: 'Inclusive furniture',
            tags: ['Accessibility'],
            issueCategories: [
              'Adjustable desk stuck',
              'Wobbly chair',
              'Broken armrest',
            ],
          },
          {
            id: 'smart_doors',
            label: '≥2 outward-opening doors, 5m apart',
            tags: ['Safety', 'Structure'],
            issueCategories: [
              'Self-closer broken',
              'Lock malfunction',
              'Door scratches',
            ],
          },
          {
            id: 'smart_ewaste',
            label: 'E-waste sorting',
            tags: ['Environment'],
            issueCategories: ['Mixed waste', 'Overflow', 'Missing bin'],
          },
          {
            id: 'smart_fire',
            label: 'Fire safety',
            tags: ['Safety'],
            issueCategories: [
              'Expired extinguisher',
              'Smoke alarm chirping',
              'No sign',
            ],
          },
        ],
      },
      {
        facilityId: 'science_lab',
        title: 'Science Laboratory',
        items: [
          {
            id: 'lab_structure',
            label: 'Structural lab shell with storage room',
            tags: ['Structure'],
            issueCategories: [
              'Wall cracks',
              'Roof leak',
              'Floor damage',
              'Door lock failure',
            ],
          },
          {
            id: 'lab_bench',
            label: 'Chemical/heat-resistant workbenches',
            tags: ['Structure', 'Safety'],
            issueCategories: [
              'Cracked surface',
              'Loose legs',
              'Stains/Corrosion',
              'Unstable',
            ],
          },
          {
            id: 'lab_utilities',
            label: 'Water, gas & electricity with shut-offs',
            tags: ['Safety', 'Sanitation'],
            issueCategories: [
              'Gas leak',
              'No water pressure',
              'Electrical spark',
              'Faulty shut-off valve',
              'Drainage blockage',
              'Power surge',
            ],
          },
          {
            id: 'lab_doors',
            label: '≥2 outward-opening doors, 5m apart',
            tags: ['Safety', 'Structure'],
            issueCategories: [
              'Stuck door',
              'Broken hinge',
              'Broken glass',
              'Self-closer failing',
            ],
          },
          {
            id: 'lab_ventilation',
            label: 'Fume management / ventilation',
            tags: ['Environment', 'Safety'],
            issueCategories: [
              'Fume hood failure',
              'Strong smells',
              'Fan noise',
              'Broken louvers',
            ],
          },
          {
            id: 'lab_waste',
            label: 'Hazardous waste disposal storage',
            tags: ['Safety', 'Sanitation'],
            issueCategories: [
              'Biohazard spill',
              'Bin overflow',
              'Lack of labels',
              'Broken container',
            ],
          },
          {
            id: 'lab_fire',
            label: 'Fire extinguisher & detection system',
            tags: ['Safety'],
            issueCategories: [
              'Expired',
              'Detector chirping',
              'Missing signage',
              'Broken alarm',
            ],
          },
          {
            id: 'lab_cctv',
            label: 'CCTV security coverage',
            tags: ['Safety'],
            issueCategories: [
              'Camera offline',
              'Poor image',
              'Cable loose',
              'NVR/DVR issue',
            ],
          },
        ],
      },
      {
        facilityId: 'language_lab',
        title: 'Language Laboratory',
        items: [
          {
            id: 'lang_boards',
            label: 'Whiteboards / Smart Boards',
            tags: ['Structure'],
            issueCategories: [
              'Surface stains',
              'Touch failure',
              'Loose mount',
              'Calibration error',
            ],
          },
          {
            id: 'lang_ict',
            label: 'ICT facilities',
            tags: ['Accessibility'],
            issueCategories: [
              'Headset broken',
              'Software error',
              'MIC issue',
              'Network down',
            ],
          },
          {
            id: 'lang_workspace',
            label: 'Inclusive student workspace',
            tags: ['Accessibility'],
            issueCategories: ['Desk damage', 'Chair broken', 'Cable clutter'],
          },
          {
            id: 'lang_sound',
            label: 'Sound insulation',
            tags: ['Structure'],
            issueCategories: ['Panel loose', 'External noise leakage'],
          },
          {
            id: 'lang_lighting',
            label: 'LED lighting',
            tags: ['Environment'],
            issueCategories: ['Bulb out', 'Dim lights'],
          },
          {
            id: 'lang_doors',
            label: '≥2 outward-opening doors',
            tags: ['Safety', 'Structure'],
            issueCategories: ['Hinge squeak', 'Latch broken'],
          },
          {
            id: 'lang_fire',
            label: 'Fire protection',
            tags: ['Safety'],
            issueCategories: ['Extinguisher missing'],
          },
          {
            id: 'lang_cctv',
            label: 'CCTV',
            tags: ['Safety'],
            issueCategories: ['No signal', 'Lens blurred'],
          },
        ],
      },
      {
        facilityId: 'special_needs',
        title: 'Special Needs Resource Room',
        items: [
          {
            id: 'sn_therapy',
            label: 'Therapy facilities & assistive tech',
            tags: ['Accessibility'],
            issueCategories: [
              'Equipment failure',
              'Tech glitch',
              'Batteries dead',
            ],
          },
          {
            id: 'sn_furniture',
            label: 'Adaptive furniture',
            tags: ['Accessibility'],
            issueCategories: ['Height adjustment stuck', 'Ramp loose'],
          },
          {
            id: 'sn_lighting',
            label: 'LED lighting',
            tags: ['Environment'],
            issueCategories: ['Harsh glare', 'Flicker'],
          },
          {
            id: 'sn_airflow',
            label: 'Natural airflow',
            tags: ['Environment'],
            issueCategories: ['Stuffy', 'Vent blocked'],
          },
          {
            id: 'sn_sound',
            label: 'Sound insulation',
            tags: ['Structure'],
            issueCategories: ['Loud background noise'],
          },
          {
            id: 'sn_safety',
            label: 'Safety systems',
            tags: ['Safety'],
            issueCategories: ['Panic button failure', 'Emergency light out'],
          },
          {
            id: 'sn_ewaste',
            label: 'E-waste sorting',
            tags: ['Environment'],
            issueCategories: ['Bin full'],
          },
        ],
      },
      {
        facilityId: 'library',
        title: 'Library',
        items: [
          {
            id: 'lib_space',
            label: 'Inclusive reading space',
            tags: ['Accessibility'],
            issueCategories: [
              'Furniture damage',
              'Carpet stain',
              'Space cramped',
            ],
          },
          {
            id: 'lib_shelves',
            label: 'Bookshelves',
            tags: ['Structure'],
            issueCategories: ['Shelf sagging', 'Loose mount', 'Termite damage'],
          },
          {
            id: 'lib_ict',
            label: 'ICT facilities',
            tags: ['Accessibility'],
            issueCategories: ['OPAC terminal down', 'WiFi weak'],
          },
          {
            id: 'lib_lighting',
            label: 'LED lighting',
            tags: ['Environment'],
            issueCategories: ['Reading lights out', 'Glaring'],
          },
          {
            id: 'lib_airflow',
            label: 'Natural airflow',
            tags: ['Environment'],
            issueCategories: ['Moisture buildup', 'Stale air'],
          },
          {
            id: 'lib_doors',
            label: '≥2 outward-opening doors',
            tags: ['Safety'],
            issueCategories: ['Lock stuck', 'Closer slammed'],
          },
          {
            id: 'lib_fire',
            label: 'Fire protection',
            tags: ['Safety'],
            issueCategories: ['Detector alarm', 'Expired CO2 tank'],
          },
          {
            id: 'lib_cctv',
            label: 'CCTV',
            tags: ['Safety'],
            issueCategories: ['Blind spot', 'Disk full'],
          },
        ],
      },
      {
        facilityId: 'tvet_workshop',
        title: 'TVET Workshop',
        items: [
          {
            id: 'tvet_space',
            label: 'Instruction/practical space',
            tags: ['Structure'],
            issueCategories: ['Floor crack', 'Roof leak', 'Workbench damage'],
          },
          {
            id: 'tvet_office',
            label: 'Trainer office',
            tags: ['Structure'],
            issueCategories: ['Furniture damage', 'Privacy issue'],
          },
          {
            id: 'tvet_furniture',
            label: 'Inclusive furniture',
            tags: ['Accessibility'],
            issueCategories: ['Wobbly table', 'Chair broken'],
          },
          {
            id: 'tvet_changing',
            label: 'Changing room',
            tags: ['Sanitation'],
            issueCategories: ['Locker broken', 'No privacy', 'Smell'],
          },
          {
            id: 'tvet_airflow',
            label: 'Natural airflow',
            tags: ['Environment'],
            issueCategories: ['Dust accumulation', 'Fumes'],
          },
          {
            id: 'tvet_lighting',
            label: 'LED lighting',
            tags: ['Environment'],
            issueCategories: ['Task light out', 'Broken switch'],
          },
          {
            id: 'tvet_fire',
            label: 'Fire detection',
            tags: ['Safety'],
            issueCategories: ['Smoke alarm faulty', 'Extinguisher empty'],
          },
          {
            id: 'tvet_waste',
            label: 'Waste sorting',
            tags: ['Environment'],
            issueCategories: ['Dustbin full', 'Hazardous waste mixed'],
          },
        ],
      },
      {
        facilityId: 'teacher_center',
        title: 'Teacher Resource Center',
        items: [
          { id: 'trc_library', label: 'Resource library', tags: ['Structure'] },
          { id: 'trc_ict', label: 'ICT facilities', tags: ['Accessibility'] },
          {
            id: 'trc_furniture',
            label: 'Inclusive furniture',
            tags: ['Accessibility'],
          },
          { id: 'trc_boards', label: 'Writing boards', tags: ['Structure'] },
          {
            id: 'trc_lighting',
            label: 'LED lighting (≥25% openings)',
            tags: ['Environment'],
          },
          {
            id: 'trc_doors',
            label: '≥2 outward-opening doors',
            tags: ['Safety'],
          },
          { id: 'trc_sound', label: 'Sound insulation', tags: ['Structure'] },
          { id: 'trc_fire', label: 'Fire detection', tags: ['Safety'] },
        ],
      },
      {
        facilityId: 'kitchen',
        title: 'Kitchen',
        items: [
          {
            id: 'kitchen_clean',
            label: 'Clean preparation area',
            tags: ['Sanitation'],
            issueCategories: [
              'Dirty surfaces',
              'Pest sighting',
              'Broken tiling',
              'Clogged sink',
            ],
          },
          {
            id: 'kitchen_cooking',
            label: 'Eco-cooking systems',
            tags: ['Environment'],
            issueCategories: [
              'Stove failure',
              'Smoke buildup',
              'Gas smell',
              'Fuel shortage',
            ],
          },
          {
            id: 'kitchen_fridge',
            label: 'Efficient refrigeration',
            tags: ['Structure'],
            issueCategories: [
              'Not cooling',
              'Water leak',
              'Door seal broken',
              'Noisy motor',
            ],
          },
          {
            id: 'kitchen_water',
            label: 'Clean water storage',
            tags: ['Sanitation'],
            issueCategories: [
              'Tank leak',
              'Contaminated water',
              'Pump failure',
              'Low level',
            ],
          },
          {
            id: 'kitchen_handwash',
            label: 'Handwashing facilities',
            tags: ['Sanitation'],
            issueCategories: [
              'No soap',
              'Broken tap',
              'Dry tank',
              'Drainage blockage',
            ],
          },
          {
            id: 'kitchen_waste',
            label: 'Liquid/solid waste treatment',
            tags: ['Environment'],
            issueCategories: [
              'Bin overflow',
              'Drainage smell',
              'Fly infestation',
              'Greywater leak',
            ],
          },
          {
            id: 'kitchen_fire',
            label: 'Fire safety',
            tags: ['Safety'],
            issueCategories: [
              'Blanket missing',
              'Expired extinguisher',
              'Gas detector failing',
              'Alarm mute',
            ],
          },
        ],
      },
      {
        facilityId: 'dining',
        title: 'Dining Hall',
        items: [
          {
            id: 'dining_space',
            label: 'Clean space',
            tags: ['Sanitation'],
            issueCategories: ['Dirty floor', 'Spills', 'Odor', 'Pests'],
          },
          {
            id: 'dining_furniture',
            label: 'Ergonomic furniture',
            tags: ['Structure'],
            issueCategories: [
              'Broken table',
              'Broken bench/chair',
              'Loose fixings',
            ],
          },
          {
            id: 'dining_water',
            label: 'Drinking water',
            tags: ['Sanitation'],
            issueCategories: [
              'Dry dispenser',
              'Leaking tap',
              'Water taste issue',
            ],
          },
          {
            id: 'dining_handwash',
            label: 'Sensor handwashing',
            tags: ['Sanitation'],
            issueCategories: ['Sensor failure', 'No soap', 'Blocked drain'],
          },
          {
            id: 'dining_lighting',
            label: 'LED lighting',
            tags: ['Environment'],
            issueCategories: ['Dead bulb', 'Flickering'],
          },
          {
            id: 'dining_fire',
            label: 'Fire protection',
            tags: ['Safety'],
            issueCategories: ['Expired extinguisher', 'Blocked exit'],
          },
          {
            id: 'dining_waste',
            label: 'Waste sorting',
            tags: ['Environment'],
            issueCategories: ['Bin overflow', 'Mixing waste'],
          },
        ],
      },
      {
        facilityId: 'multipurpose',
        title: 'Multipurpose Hall',
        items: [
          {
            id: 'multi_stage',
            label: 'Stage area',
            tags: ['Structure'],
            issueCategories: [
              'Floor damage',
              'Curtain torn',
              'Lighting failure',
            ],
          },
          {
            id: 'multi_furniture',
            label: 'Ergonomic furniture',
            tags: ['Structure'],
            issueCategories: ['Broken chairs', 'Stacked haphazardly'],
          },
          {
            id: 'multi_changing',
            label: 'Changing room',
            tags: ['Sanitation'],
            issueCategories: ['Lock broken', 'No light', 'Smell'],
          },
          {
            id: 'multi_storage',
            label: 'Electronics storage',
            tags: ['Structure'],
            issueCategories: ['Lock failure', 'Humidity issue'],
          },
          {
            id: 'multi_lighting',
            label: 'LED lighting',
            tags: ['Environment'],
            issueCategories: ['High-bay light out', 'Dimmer failure'],
          },
          {
            id: 'multi_washroom',
            label: 'Accessible washrooms',
            tags: ['Accessibility'],
            issueCategories: ['Grab rail loose', 'Flush failure', 'No water'],
          },
          {
            id: 'multi_fire',
            label: 'Fire safety',
            tags: ['Safety'],
            issueCategories: ['Hose reel leak', 'Signal blocked'],
          },
        ],
      },
      {
        facilityId: 'sports',
        title: 'Sport & Recreation',
        items: [
          {
            id: 'sport_playground',
            label: 'Inclusive playground',
            tags: ['Accessibility'],
            issueCategories: [
              'Broken equipment',
              'Sharp edges',
              'Rusting',
              'Loose bolts',
            ],
          },
          {
            id: 'sport_safety',
            label: 'Safe surfaces',
            tags: ['Safety'],
            issueCategories: [
              'Cracked court',
              'Uneven ground',
              'Slippery surface',
              'Puddles',
            ],
          },
          {
            id: 'sport_drr',
            label: 'Disaster risk prevention',
            tags: ['Safety'],
            issueCategories: [
              'Retaining wall crack',
              'Soil erosion',
              'Poor drainage',
            ],
          },
          {
            id: 'sport_exercise',
            label: 'Exercise areas',
            tags: ['Accessibility'],
            issueCategories: [
              'Damaged bars',
              'Missing components',
              'Vandalism',
            ],
          },
          {
            id: 'sport_lighting',
            label: 'Lighting system',
            tags: ['Environment'],
            issueCategories: [
              'Floodlight out',
              'Cable exposure',
              'Timer failure',
            ],
          },
        ],
      },
      {
        facilityId: 'sleeping',
        title: 'Sleeping Room',
        items: [
          {
            id: 'sleep_bedding',
            label: 'Safe bedding',
            tags: ['Safety'],
            issueCategories: [
              'Torn mattress',
              'Broken bed frame',
              'Bedbugs/Pests',
            ],
          },
          {
            id: 'sleep_lighting',
            label: 'LED lighting',
            tags: ['Environment'],
            issueCategories: ['Bulb out', 'Broken switch'],
          },
          {
            id: 'sleep_airflow',
            label: 'Natural airflow',
            tags: ['Environment'],
            issueCategories: ['Window stuck', 'Vent blocked', 'Stuffy'],
          },
          {
            id: 'sleep_washroom',
            label: 'Gender-segregated washrooms',
            tags: ['Sanitation'],
            issueCategories: ['Clogged toilet', 'No water', 'Door broken'],
          },
          {
            id: 'sleep_fire',
            label: 'Fire safety',
            tags: ['Safety'],
            issueCategories: ['Alarm missing', 'Blocked aisle'],
          },
          {
            id: 'sleep_cctv',
            label: 'CCTV',
            tags: ['Safety'],
            issueCategories: ['Power failure', 'Obstructed view'],
          },
        ],
      },
      {
        facilityId: 'dormitories',
        title: 'Dormitories',
        items: [
          {
            id: 'dorm_bedding',
            label: 'Safe bedding',
            tags: ['Safety'],
            issueCategories: [
              'Torn mattress',
              'Broken bed frame',
              'Bedbugs/Pests',
            ],
          },
          {
            id: 'dorm_patron',
            label: 'Patron/Matron room',
            tags: ['Structure'],
            issueCategories: ['Lock failure', 'Damp walls', 'No desk'],
          },
          {
            id: 'dorm_washroom',
            label: 'Gender-segregated washrooms',
            tags: ['Sanitation'],
            issueCategories: ['Clogged toilet', 'No water', 'Door broken'],
          },
          {
            id: 'dorm_laundry',
            label: 'Laundry area',
            tags: ['Sanitation'],
            issueCategories: [
              'Drainage block',
              'Trough crack',
              'Water shortage',
            ],
          },
          {
            id: 'dorm_fire',
            label: 'Fire safety',
            tags: ['Safety'],
            issueCategories: ['Extinguisher missing', 'Blocked exit'],
          },
          {
            id: 'dorm_cctv',
            label: 'CCTV',
            tags: ['Safety'],
            issueCategories: ['Camera offline', 'Blurred image'],
          },
        ],
      },
      {
        facilityId: 'sickbay',
        title: 'Sickbay',
        items: [
          {
            id: 'sickbed',
            label: 'Medical bedding',
            tags: ['Safety'],
            issueCategories: ['Soiled mattress', 'Broken bed'],
          },
          {
            id: 'firstaid',
            label: 'First aid kit',
            tags: ['Safety'],
            issueCategories: ['Empty kit', 'Expired meds'],
          },
          {
            id: 'communication',
            label: 'Communication facilities',
            tags: ['Structure'],
            issueCategories: ['Phone out', 'Radio broken'],
          },
          {
            id: 'sick_airflow',
            label: 'Natural airflow',
            tags: ['Environment'],
            issueCategories: ['Window jammed', 'Stuffy air'],
          },
          {
            id: 'sick_washroom',
            label: 'Washrooms',
            tags: ['Sanitation'],
            issueCategories: ['Flush failure', 'Leak', 'No soap'],
          },
          {
            id: 'sick_waste',
            label: 'Hazardous waste sorting',
            tags: ['Safety'],
            issueCategories: ['Sharps bin full', 'Mixing medical waste'],
          },
        ],
      },
      {
        facilityId: 'girls_room',
        title: 'Girls Room',
        items: [
          {
            id: 'girl_bedding',
            label: 'Safe bedding',
            tags: ['Safety'],
            issueCategories: ['Torn mattress', 'Broken leg'],
          },
          {
            id: 'girl_firstaid',
            label: 'First aid kit',
            tags: ['Safety'],
            issueCategories: ['Expired supplies', 'Empty box'],
          },
          {
            id: 'girl_comm',
            label: 'Communication facilities',
            tags: ['Structure'],
            issueCategories: ['No connection'],
          },
          {
            id: 'girl_airflow',
            label: 'Natural airflow',
            tags: ['Environment'],
            issueCategories: ['Window broken', 'Vent blocked'],
          },
          {
            id: 'girl_washroom',
            label: 'Washrooms',
            tags: ['Sanitation'],
            issueCategories: ['No water', 'Pads disposal full', 'Door broken'],
          },
        ],
      },
      {
        facilityId: 'washrooms',
        title: 'Washrooms',
        items: [
          {
            id: 'wc_toilets',
            label: 'Gender-separated toilets',
            tags: ['Sanitation'],
            issueCategories: [
              'Clogged toilet',
              'Broken flush',
              'Broken door/lock',
              'No water',
              'Smell issue',
            ],
          },
          {
            id: 'wc_urinals',
            label: 'Boys urinals',
            tags: ['Sanitation'],
            issueCategories: [
              'Stuck valve',
              'Unpleasant odor',
              'Crack in unit',
              'Drainage blockage',
            ],
          },
          {
            id: 'wc_handwash',
            label: 'Handwashing system',
            tags: ['Sanitation'],
            issueCategories: [
              'No soap',
              'Broken tap',
              'Leaking pipe',
              'Dry tank',
            ],
          },
          {
            id: 'wc_waste',
            label: 'Liquid waste treatment',
            tags: ['Environment'],
            issueCategories: [
              'Septic tank full',
              'Pipe burst',
              'Overflow',
              'Foul smell',
            ],
          },
          {
            id: 'wc_lighting',
            label: 'LED lighting',
            tags: ['Environment'],
            issueCategories: [
              'Dark area',
              'Dead bulb',
              'Flickering',
              'Exposed wires',
            ],
          },
        ],
      },
      {
        facilityId: 'residence',
        title: 'Head Teacher Residence',
        items: [
          {
            id: 'res_furniture',
            label: 'Basic furniture',
            tags: ['Structure'],
            issueCategories: ['Broken chair', 'Desk damage'],
          },
          {
            id: 'res_cooking',
            label: 'Eco-cooking',
            tags: ['Environment'],
            issueCategories: ['Stove smoke', 'Fuel leak'],
          },
          {
            id: 'res_water',
            label: 'Clean water & washrooms',
            tags: ['Sanitation'],
            issueCategories: ['Tap leak', 'Toilet clog', 'No water'],
          },
          {
            id: 'res_lighting',
            label: 'LED lighting',
            tags: ['Environment'],
            issueCategories: ['Bulb out'],
          },
          {
            id: 'res_fire',
            label: 'Fire protection',
            tags: ['Safety'],
            issueCategories: ['No extinguisher'],
          },
        ],
      },
      {
        facilityId: 'outdoor',
        title: 'Outdoor Space',
        items: [
          {
            id: 'out_parking',
            label: 'Green parking',
            tags: ['Environment'],
            issueCategories: ['Oil spill', 'Soil erosion', 'Pothole'],
          },
          {
            id: 'out_paths',
            label: 'Permeable pathways',
            tags: ['Environment'],
            issueCategories: ['Puddles', 'Broken pavers', 'Slippery'],
          },
          {
            id: 'out_rain',
            label: 'Rainwater harvesting',
            tags: ['Environment'],
            issueCategories: ['Gutter leak', 'Blocked filter', 'Tank damage'],
          },
          {
            id: 'out_lighting',
            label: 'Solar/LED lighting',
            tags: ['Environment'],
            issueCategories: ['Panel dirty', 'Light out', 'Battery failure'],
          },
          {
            id: 'out_waste',
            label: 'Waste sorting & composting',
            tags: ['Environment'],
            issueCategories: ['Odor', 'Pests', 'Sort mix'],
          },
        ],
      },
      {
        facilityId: 'fencing',
        title: 'School Fencing',
        items: [
          {
            id: 'fence_material',
            label: 'Eco-friendly materials',
            tags: ['Environment'],
            issueCategories: [
              'Rusted wire',
              'Broken post',
              'Hole in fence',
              'Leaning wall',
            ],
          },
          {
            id: 'fence_access',
            label: 'Accessible entrance',
            tags: ['Accessibility'],
            issueCategories: [
              'Gate stuck',
              'Broken ramp',
              'Broken handle',
              'Key lost',
            ],
          },
          {
            id: 'fence_security',
            label: 'Passive surveillance',
            tags: ['Safety'],
            issueCategories: [
              'CCTV offline',
              'Blind spot',
              'Broken light',
              'Overgrown bushes',
            ],
          },
          {
            id: 'fence_guard',
            label: 'Guardhouse',
            tags: ['Safety'],
            issueCategories: [
              'Broken window',
              'Furniture damage',
              'No radio',
              'Roof leak',
            ],
          },
          {
            id: 'fence_standard',
            label: 'Standards compliance',
            tags: ['Structure'],
            issueCategories: ['Too low', 'Sharp edges', 'Unstable structure'],
          },
        ],
      },
    ];

    for (const f of facilities) {
      const existing = await this.facilityRepo.findOne({
        where: { facilityId: f.facilityId },
      });
      if (existing) {
        existing.items = f.items;
        existing.title = f.title;
        await this.facilityRepo.save(existing);
      } else {
        await this.facilityRepo.save(this.facilityRepo.create(f));
      }
    }
    this.logger.log(
      `✅ Seeded/Updated ${facilities.length} facility categories`,
    );
  }
}
