import { sql } from '@vercel/postgres';
import {
    Organization,
    Event,
    Fight,
    Fighter,
  } from './definitions';

export async function fetchOrganizations() {
    try {
      // Artificially delay a response for demo purposes.
      // Don't do this in production :)
  
      // console.log('Fetching revenue data...');
      // await new Promise((resolve) => setTimeout(resolve, 3000));
  
      const data = await sql<Organization>`SELECT * FROM organizations`;
  
      // console.log('Data fetch completed after 3 seconds.');
  
      return data.rows;
    } catch (error) {
      console.error('Database Error:', error);
      throw new Error('Failed to fetch revenue data.');
    }
  }

  export async function fetchEventsByOrg(orgId: string) {
    try {
      // Artificially delay a response for demo purposes.
      // Don't do this in production :)
  
      // console.log('Fetching revenue data...');
      // await new Promise((resolve) => setTimeout(resolve, 3000));
  
      const data = await sql<Event>`SELECT * FROM Events WHERE organization_id = ${orgId}`;
  
      // console.log('Data fetch completed after 3 seconds.');
  
      return data.rows;
    } catch (error) {
      console.error('Database Error:', error);
      throw new Error('Failed to fetch revenue data.');
    }
  }