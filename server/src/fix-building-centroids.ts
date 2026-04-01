import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SchoolsService } from './modules/schools/schools.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SchoolBuilding } from './modules/schools/entities/school-building.entity';
import { Repository } from 'typeorm';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const repo = app.get<Repository<SchoolBuilding>>(getRepositoryToken(SchoolBuilding));
  
  const buildings = await repo.find();
  console.log(`Found ${buildings.length} buildings to update.`);
  
  if (buildings.length > 0) {
    console.log("Sample building data:", JSON.stringify(buildings[0], null, 2));
  }
  
  let updated = 0;
  for (const b of buildings) {
    // If centroid is NULL, try to find coordinates in annotations or other fields
    if (!b.centroidLat || !b.centroidLng) {
      // 1. Check annotations for coordinates
      const anyAnnotationWithCoords = b.annotations?.find(a => a && a.coordinates && a.coordinates.length > 0);
      
      let lat: number | null = null;
      let lng: number | null = null;
      
      if (anyAnnotationWithCoords) {
        const ann = anyAnnotationWithCoords;
        const rawPts = ann.coordinates;
        
        if (!rawPts || rawPts.length === 0) continue;

        if (ann.type === 'point' || (ann.type as string) === 'pin') {
          lat = Number(rawPts[1]);
          lng = Number(rawPts[0]);
        } else {
          // It's a line or polygon
          let pairs: [number, number][] = [];
          if (Array.isArray(rawPts[0])) {
            pairs = (rawPts as any[]).map((c: any) => [Number(c[0]), Number(c[1])] as [number, number]);
          } else {
            for (let i = 0; i + 1 < (rawPts as number[]).length; i += 2) {
              pairs.push([Number(rawPts[i]), Number(rawPts[i + 1])]);
            }
          }
          if (pairs.length > 0) {
            lat = pairs.reduce((sum, p) => sum + p[1], 0) / pairs.length;
            lng = pairs.reduce((sum, p) => sum + p[0], 0) / pairs.length;
          }
        }
      }
      
      if (lat && lng) {
        b.centroidLat = lat;
        b.centroidLng = lng;
        await repo.save(b);
        updated++;
      }
    }
  }
  
  console.log(`Successfully updated ${updated} buildings with centroids.`);
  await app.close();
}

bootstrap();
