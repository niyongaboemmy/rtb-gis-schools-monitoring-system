import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Role } from '../roles/entities/role.entity';
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
  ) {}

  async onModuleInit() {
    await this.seedAdminUser();
    await this.seedSampleSchools();
    await this.seedFacilities();
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
    const count = await this.facilityRepo.count();
    if (count > 0) return;

    const facilities = [
      {
        facilityId: 'administration',
        title: 'Administration Office',
        items: [
          {
            id: 'admin_visitor',
            label: 'Welcoming visitor space',
            tags: ['Structure'],
          },
          {
            id: 'admin_offices',
            label: 'Private offices available',
            tags: ['Structure'],
          },
          {
            id: 'admin_washroom',
            label: 'Accessible washrooms',
            tags: ['Sanitation', 'Accessibility'],
          },
          {
            id: 'admin_lighting',
            label: 'LED lighting',
            tags: ['Environment'],
          },
          {
            id: 'admin_ict',
            label: 'Adaptive ICT facilities',
            tags: ['Accessibility'],
          },
          {
            id: 'admin_waste',
            label: 'Waste collection for recycling',
            tags: ['Environment'],
          },
          { id: 'admin_fire', label: 'Fire protection', tags: ['Safety'] },
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
          },
          {
            id: 'class_doors',
            label: '≥2 outward-opening doors, 5m apart',
            tags: ['Safety', 'Structure'],
          },
          {
            id: 'class_windows',
            label: 'Windows for natural light (≥25%)',
            tags: ['Environment', 'Structure'],
          },
          {
            id: 'class_ventilation',
            label: 'Natural ventilation / airflow',
            tags: ['Environment'],
          },
          { id: 'class_sound', label: 'Sound insulation', tags: ['Structure'] },
          {
            id: 'class_access',
            label: 'Interior circulation space',
            tags: ['Accessibility'],
          },
          {
            id: 'class_fire',
            label: 'Fire extinguisher (1×12kg per 3 rooms)',
            tags: ['Safety'],
          },
          {
            id: 'class_lighting',
            label: 'LED or natural lighting system',
            tags: ['Environment'],
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
          },
          {
            id: 'smart_lighting',
            label: 'LED lighting',
            tags: ['Environment'],
          },
          {
            id: 'smart_ventilation',
            label: 'Natural ventilation',
            tags: ['Environment'],
          },
          {
            id: 'smart_furniture',
            label: 'Inclusive furniture',
            tags: ['Accessibility'],
          },
          {
            id: 'smart_doors',
            label: '≥2 outward-opening doors, 5m apart',
            tags: ['Safety', 'Structure'],
          },
          {
            id: 'smart_ewaste',
            label: 'E-waste sorting',
            tags: ['Environment'],
          },
          { id: 'smart_fire', label: 'Fire safety', tags: ['Safety'] },
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
          },
          {
            id: 'lab_bench',
            label: 'Chemical/heat-resistant workbenches',
            tags: ['Structure', 'Safety'],
          },
          {
            id: 'lab_utilities',
            label: 'Water, gas & electricity with shut-offs',
            tags: ['Safety', 'Sanitation'],
          },
          {
            id: 'lab_doors',
            label: '≥2 outward-opening doors, 5m apart',
            tags: ['Safety', 'Structure'],
          },
          {
            id: 'lab_ventilation',
            label: 'Fume management / ventilation',
            tags: ['Environment', 'Safety'],
          },
          {
            id: 'lab_waste',
            label: 'Hazardous waste disposal storage',
            tags: ['Safety', 'Sanitation'],
          },
          {
            id: 'lab_fire',
            label: 'Fire extinguisher & detection system',
            tags: ['Safety'],
          },
          { id: 'lab_cctv', label: 'CCTV security coverage', tags: ['Safety'] },
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
          },
          { id: 'lang_ict', label: 'ICT facilities', tags: ['Accessibility'] },
          {
            id: 'lang_workspace',
            label: 'Inclusive student workspace',
            tags: ['Accessibility'],
          },
          { id: 'lang_sound', label: 'Sound insulation', tags: ['Structure'] },
          { id: 'lang_lighting', label: 'LED lighting', tags: ['Environment'] },
          {
            id: 'lang_doors',
            label: '≥2 outward-opening doors',
            tags: ['Safety', 'Structure'],
          },
          { id: 'lang_fire', label: 'Fire protection', tags: ['Safety'] },
          { id: 'lang_cctv', label: 'CCTV', tags: ['Safety'] },
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
          },
          {
            id: 'sn_furniture',
            label: 'Adaptive furniture',
            tags: ['Accessibility'],
          },
          { id: 'sn_lighting', label: 'LED lighting', tags: ['Environment'] },
          { id: 'sn_airflow', label: 'Natural airflow', tags: ['Environment'] },
          { id: 'sn_sound', label: 'Sound insulation', tags: ['Structure'] },
          { id: 'sn_safety', label: 'Safety systems', tags: ['Safety'] },
          { id: 'sn_ewaste', label: 'E-waste sorting', tags: ['Environment'] },
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
          },
          { id: 'lib_shelves', label: 'Bookshelves', tags: ['Structure'] },
          { id: 'lib_ict', label: 'ICT facilities', tags: ['Accessibility'] },
          { id: 'lib_lighting', label: 'LED lighting', tags: ['Environment'] },
          {
            id: 'lib_airflow',
            label: 'Natural airflow',
            tags: ['Environment'],
          },
          {
            id: 'lib_doors',
            label: '≥2 outward-opening doors',
            tags: ['Safety'],
          },
          { id: 'lib_fire', label: 'Fire protection', tags: ['Safety'] },
          { id: 'lib_cctv', label: 'CCTV', tags: ['Safety'] },
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
          },
          { id: 'tvet_office', label: 'Trainer office', tags: ['Structure'] },
          {
            id: 'tvet_furniture',
            label: 'Inclusive furniture',
            tags: ['Accessibility'],
          },
          { id: 'tvet_changing', label: 'Changing room', tags: ['Sanitation'] },
          {
            id: 'tvet_airflow',
            label: 'Natural airflow',
            tags: ['Environment'],
          },
          { id: 'tvet_lighting', label: 'LED lighting', tags: ['Environment'] },
          { id: 'tvet_fire', label: 'Fire detection', tags: ['Safety'] },
          { id: 'tvet_waste', label: 'Waste sorting', tags: ['Environment'] },
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
          },
          {
            id: 'kitchen_cooking',
            label: 'Eco-cooking systems',
            tags: ['Environment'],
          },
          {
            id: 'kitchen_fridge',
            label: 'Efficient refrigeration',
            tags: ['Structure'],
          },
          {
            id: 'kitchen_water',
            label: 'Clean water storage',
            tags: ['Sanitation'],
          },
          {
            id: 'kitchen_handwash',
            label: 'Handwashing facilities',
            tags: ['Sanitation'],
          },
          {
            id: 'kitchen_waste',
            label: 'Liquid/solid waste treatment',
            tags: ['Environment'],
          },
          { id: 'kitchen_fire', label: 'Fire safety', tags: ['Safety'] },
        ],
      },
      {
        facilityId: 'dining',
        title: 'Dining Hall',
        items: [
          { id: 'dining_space', label: 'Clean space', tags: ['Sanitation'] },
          {
            id: 'dining_furniture',
            label: 'Ergonomic furniture',
            tags: ['Structure'],
          },
          { id: 'dining_water', label: 'Drinking water', tags: ['Sanitation'] },
          {
            id: 'dining_handwash',
            label: 'Sensor handwashing',
            tags: ['Sanitation'],
          },
          {
            id: 'dining_lighting',
            label: 'LED lighting',
            tags: ['Environment'],
          },
          { id: 'dining_fire', label: 'Fire protection', tags: ['Safety'] },
          { id: 'dining_waste', label: 'Waste sorting', tags: ['Environment'] },
        ],
      },
      {
        facilityId: 'multipurpose',
        title: 'Multipurpose Hall',
        items: [
          { id: 'multi_stage', label: 'Stage area', tags: ['Structure'] },
          {
            id: 'multi_furniture',
            label: 'Ergonomic furniture',
            tags: ['Structure'],
          },
          {
            id: 'multi_changing',
            label: 'Changing room',
            tags: ['Sanitation'],
          },
          {
            id: 'multi_storage',
            label: 'Electronics storage',
            tags: ['Structure'],
          },
          {
            id: 'multi_lighting',
            label: 'LED lighting',
            tags: ['Environment'],
          },
          {
            id: 'multi_washroom',
            label: 'Accessible washrooms',
            tags: ['Accessibility'],
          },
          { id: 'multi_fire', label: 'Fire safety', tags: ['Safety'] },
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
          },
          { id: 'sport_safety', label: 'Safe surfaces', tags: ['Safety'] },
          {
            id: 'sport_drr',
            label: 'Disaster risk prevention',
            tags: ['Safety'],
          },
          {
            id: 'sport_exercise',
            label: 'Exercise areas',
            tags: ['Accessibility'],
          },
          {
            id: 'sport_lighting',
            label: 'Lighting system',
            tags: ['Environment'],
          },
        ],
      },
      {
        facilityId: 'sleeping',
        title: 'Sleeping Room',
        items: [
          { id: 'sleep_bedding', label: 'Safe bedding', tags: ['Safety'] },
          {
            id: 'sleep_lighting',
            label: 'LED lighting',
            tags: ['Environment'],
          },
          {
            id: 'sleep_airflow',
            label: 'Natural airflow',
            tags: ['Environment'],
          },
          {
            id: 'sleep_washroom',
            label: 'Gender-segregated washrooms',
            tags: ['Sanitation'],
          },
          { id: 'sleep_fire', label: 'Fire safety', tags: ['Safety'] },
          { id: 'sleep_cctv', label: 'CCTV', tags: ['Safety'] },
        ],
      },
      {
        facilityId: 'dormitories',
        title: 'Dormitories',
        items: [
          { id: 'dorm_bedding', label: 'Safe bedding', tags: ['Safety'] },
          {
            id: 'dorm_patron',
            label: 'Patron/Matron room',
            tags: ['Structure'],
          },
          {
            id: 'dorm_washroom',
            label: 'Gender-segregated washrooms',
            tags: ['Sanitation'],
          },
          { id: 'dorm_laundry', label: 'Laundry area', tags: ['Sanitation'] },
          { id: 'dorm_fire', label: 'Fire safety', tags: ['Safety'] },
          { id: 'dorm_cctv', label: 'CCTV', tags: ['Safety'] },
        ],
      },
      {
        facilityId: 'sickbay',
        title: 'Sickbay',
        items: [
          { id: 'sickbed', label: 'Medical bedding', tags: ['Safety'] },
          { id: 'firstaid', label: 'First aid kit', tags: ['Safety'] },
          {
            id: 'communication',
            label: 'Communication facilities',
            tags: ['Structure'],
          },
          {
            id: 'sick_airflow',
            label: 'Natural airflow',
            tags: ['Environment'],
          },
          { id: 'sick_washroom', label: 'Washrooms', tags: ['Sanitation'] },
          {
            id: 'sick_waste',
            label: 'Hazardous waste sorting',
            tags: ['Safety'],
          },
        ],
      },
      {
        facilityId: 'girls_room',
        title: 'Girls Room',
        items: [
          { id: 'girl_bedding', label: 'Safe bedding', tags: ['Safety'] },
          { id: 'girl_firstaid', label: 'First aid kit', tags: ['Safety'] },
          {
            id: 'girl_comm',
            label: 'Communication facilities',
            tags: ['Structure'],
          },
          {
            id: 'girl_airflow',
            label: 'Natural airflow',
            tags: ['Environment'],
          },
          { id: 'girl_washroom', label: 'Washrooms', tags: ['Sanitation'] },
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
          },
          { id: 'wc_urinals', label: 'Boys urinals', tags: ['Sanitation'] },
          {
            id: 'wc_handwash',
            label: 'Handwashing system',
            tags: ['Sanitation'],
          },
          {
            id: 'wc_waste',
            label: 'Liquid waste treatment',
            tags: ['Environment'],
          },
          { id: 'wc_lighting', label: 'LED lighting', tags: ['Environment'] },
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
          },
          { id: 'res_cooking', label: 'Eco-cooking', tags: ['Environment'] },
          {
            id: 'res_water',
            label: 'Clean water & washrooms',
            tags: ['Sanitation'],
          },
          { id: 'res_lighting', label: 'LED lighting', tags: ['Environment'] },
          { id: 'res_fire', label: 'Fire protection', tags: ['Safety'] },
        ],
      },
      {
        facilityId: 'outdoor',
        title: 'Outdoor Space',
        items: [
          { id: 'out_parking', label: 'Green parking', tags: ['Environment'] },
          {
            id: 'out_paths',
            label: 'Permeable pathways',
            tags: ['Environment'],
          },
          {
            id: 'out_rain',
            label: 'Rainwater harvesting',
            tags: ['Environment'],
          },
          {
            id: 'out_lighting',
            label: 'Solar/LED lighting',
            tags: ['Environment'],
          },
          {
            id: 'out_waste',
            label: 'Waste sorting & composting',
            tags: ['Environment'],
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
          },
          {
            id: 'fence_access',
            label: 'Accessible entrance',
            tags: ['Accessibility'],
          },
          {
            id: 'fence_security',
            label: 'Passive surveillance',
            tags: ['Safety'],
          },
          { id: 'fence_guard', label: 'Guardhouse', tags: ['Safety'] },
          {
            id: 'fence_standard',
            label: 'Standards compliance',
            tags: ['Structure'],
          },
        ],
      },
    ];

    for (const f of facilities) {
      await this.facilityRepo.save(this.facilityRepo.create(f));
    }
    this.logger.log(`✅ Seeded ${facilities.length} facility categories`);
  }
}
