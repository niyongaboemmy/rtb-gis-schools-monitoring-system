/**
 * Rwanda Administrative Divisions
 * Provinces → Districts → Sectors
 */

export interface RwandaDistrict {
  name: string;
  sectors: string[];
}

export interface RwandaProvince {
  name: string;
  districts: RwandaDistrict[];
}

export const RWANDA_PROVINCES: RwandaProvince[] = [
  {
    name: "Kigali City",
    districts: [
      {
        name: "Gasabo",
        sectors: [
          "Bumbogo", "Gatsata", "Gikomero", "Gisozi", "Jabana", "Jali",
          "Kacyiru", "Kimihurura", "Kimironko", "Kinyinya", "Ndera",
          "Nduba", "Remera", "Rusororo", "Rutunga",
        ],
      },
      {
        name: "Kicukiro",
        sectors: [
          "Gahanga", "Gatenga", "Gikondo", "Kagarama", "Kanombe",
          "Kicukiro", "Kigarama", "Masaka", "Niboye", "Nyarugunga",
        ],
      },
      {
        name: "Nyarugenge",
        sectors: [
          "Gitega", "Kanyinya", "Kigali", "Kimisagara", "Mageragere",
          "Muhima", "Nyakabanda", "Nyamirambo", "Nyarugenge", "Rwezamenyo",
        ],
      },
    ],
  },
  {
    name: "Eastern Province",
    districts: [
      {
        name: "Bugesera",
        sectors: [
          "Gashora", "Juru", "Kamabuye", "Mareba", "Mayange", "Musenyi",
          "Mwendo", "Ngeruka", "Ntarama", "Nyamata", "Nyarugenge",
          "Rilima", "Ruhuha", "Rweru", "Shyara",
        ],
      },
      {
        name: "Gatsibo",
        sectors: [
          "Gasange", "Gatsibo", "Gitoki", "Kabarore", "Kageyo",
          "Kiramuruzi", "Kiziguro", "Muhura", "Murambi", "Ngarama",
          "Nyagihanga", "Remera", "Rugarama", "Rwimbogo",
        ],
      },
      {
        name: "Kayonza",
        sectors: [
          "Gahini", "Kabare", "Kabarondo", "Mukarange", "Murama",
          "Murundi", "Mwiri", "Ndego", "Nyamirama", "Rukara",
          "Ruramira", "Rwinkwavu",
        ],
      },
      {
        name: "Kirehe",
        sectors: [
          "Gahara", "Gatore", "Kigarama", "Kigina", "Kirehe",
          "Mahama", "Mpanga", "Musaza", "Mushikiri", "Nasho",
          "Nyamugari", "Nyarubuye",
        ],
      },
      {
        name: "Ngoma",
        sectors: [
          "Gashanda", "Jarama", "Karembo", "Kazo", "Kibungo",
          "Mugesera", "Murama", "Mutenderi", "Remera", "Rukira",
          "Rukumberi", "Rurenge", "Sake", "Zaza",
        ],
      },
      {
        name: "Nyagatare",
        sectors: [
          "Gatunda", "Karama", "Karangazi", "Katabagemu", "Kibali",
          "Matimba", "Mimuli", "Mukama", "Musheri", "Nyagatare",
          "Rwimiyaga", "Tabagwe",
        ],
      },
      {
        name: "Rwamagana",
        sectors: [
          "Fumbwe", "Gahengeri", "Gishari", "Karenge", "Kigabiro",
          "Muhazi", "Munyaga", "Munyiginya", "Musha", "Muyumbu",
          "Mwulire", "Nyakariro", "Nzige", "Rubona",
        ],
      },
    ],
  },
  {
    name: "Northern Province",
    districts: [
      {
        name: "Burera",
        sectors: [
          "Bungwe", "Butaro", "Cyanika", "Cyeru", "Gahunga", "Gatebe",
          "Gitovu", "Kagogo", "Kinoni", "Kinyababa", "Kivuye", "Nemba",
          "Rugarama", "Rugendabari", "Ruhunde", "Rusarabuye", "Rwerere",
        ],
      },
      {
        name: "Gakenke",
        sectors: [
          "Busengo", "Coko", "Cyabingo", "Gakenke", "Gashenyi",
          "Janja", "Kamubuga", "Karambo", "Kivuruga", "Mataba",
          "Minazi", "Mugunga", "Muhondo", "Muyongwe", "Muzo",
          "Nemba", "Ruli", "Rusasa", "Rushashi",
        ],
      },
      {
        name: "Gicumbi",
        sectors: [
          "Bukure", "Bwisige", "Byumba", "Cyumba", "Giti", "Kaniga",
          "Manyagiro", "Miyove", "Mukarange", "Muko", "Mutete",
          "Nyamiyaga", "Nyankenke", "Rubaya", "Rukomo", "Rushaki",
          "Rutare", "Rwamagana", "Shangasha",
        ],
      },
      {
        name: "Musanze",
        sectors: [
          "Busogo", "Cyuve", "Gacaca", "Gashaki", "Gataraga",
          "Kimonyi", "Kinigi", "Muhoza", "Mukamira", "Musanze",
          "Nkotsi", "Nyange", "Remera", "Rwaza", "Shingiro",
        ],
      },
      {
        name: "Rulindo",
        sectors: [
          "Base", "Burega", "Bushoki", "Buyoga", "Cyinzuzi",
          "Cyungo", "Kinihira", "Kisaro", "Masoro", "Mbogo",
          "Murambi", "Ngoma", "Ntarabana", "Rukozo", "Rusiga",
          "Shyorongi", "Tumba",
        ],
      },
    ],
  },
  {
    name: "Southern Province",
    districts: [
      {
        name: "Gisagara",
        sectors: [
          "Gikonko", "Gishubi", "Kansi", "Kibilizi", "Kibirizi",
          "Muganza", "Mukingo", "Muko", "Munini", "Ndora",
          "Nyanza", "Save",
        ],
      },
      {
        name: "Huye",
        sectors: [
          "Gishamvu", "Huye", "Karama", "Kigoma", "Kinazi",
          "Maraba", "Mbazi", "Mukura", "Ngoma", "Ruhashya",
          "Rusatira", "Rwaniro", "Simbi", "Tumba",
        ],
      },
      {
        name: "Kamonyi",
        sectors: [
          "Gacurabwenge", "Kamonyi", "Kayenzi", "Kayumbu", "Mugina",
          "Musambira", "Ngamba", "Nyamiyaga", "Nyarubaka", "Rugarika",
          "Rukoma", "Runda",
        ],
      },
      {
        name: "Muhanga",
        sectors: [
          "Cyeza", "Kabacuzi", "Kibangu", "Kiyumba", "Muhanga",
          "Mushishiro", "Nyamabuye", "Nyarusange", "Rongi",
          "Rugendabari", "Shyogwe",
        ],
      },
      {
        name: "Nyamagabe",
        sectors: [
          "Buruhukiro", "Cyanika", "Gasaka", "Gatare", "Kaduha",
          "Kamegeri", "Kibirizi", "Kibumbwe", "Kitabi", "Mbazi",
          "Mugano", "Musange", "Musebeya", "Nkomane", "Tare", "Uwinkingi",
        ],
      },
      {
        name: "Nyanza",
        sectors: [
          "Busasamana", "Cyabakamyi", "Kibirizi", "Kigoma",
          "Mukingo", "Muyira", "Ntyazo", "Nyagisozi", "Rwabicuma",
        ],
      },
      {
        name: "Nyaruguru",
        sectors: [
          "Cyahinda", "Kibeho", "Kivu", "Mata", "Muganza",
          "Munini", "Ngera", "Ngoma", "Nyabimata", "Nyagisozi",
          "Ruheru", "Ruramba", "Rusenge",
        ],
      },
      {
        name: "Ruhango",
        sectors: [
          "Byimana", "Kabagali", "Kinazi", "Kinihira", "Mbuye",
          "Mwendo", "Ntongwe", "Ruhango",
        ],
      },
    ],
  },
  {
    name: "Western Province",
    districts: [
      {
        name: "Karongi",
        sectors: [
          "Bwishyura", "Gashari", "Gishyita", "Gitesi", "Mubuga",
          "Murambi", "Murundi", "Mutuntu", "Rubengera", "Rugabano",
          "Ruganda", "Rwankuba", "Twumba",
        ],
      },
      {
        name: "Ngororero",
        sectors: [
          "Bwira", "Gatumba", "Hindiro", "Kabaya", "Kageyo",
          "Kavumu", "Matyazo", "Muhanda", "Muhororo", "Ndaro",
          "Ngororero", "Nyange", "Sovu",
        ],
      },
      {
        name: "Nyabihu",
        sectors: [
          "Bigogwe", "Jenda", "Jomba", "Kabatwa", "Karago",
          "Kintobo", "Mukamira", "Muringa", "Rambura", "Rugera",
          "Rurembo", "Shyira",
        ],
      },
      {
        name: "Nyamasheke",
        sectors: [
          "Bushekeri", "Bushenge", "Cyato", "Gihombo", "Kagano",
          "Kanjongo", "Karambi", "Karengera", "Kirimbi", "Macuba",
          "Mahembe", "Nyabitekeri", "Rangiro", "Ruharambuga", "Shangi",
        ],
      },
      {
        name: "Rubavu",
        sectors: [
          "Bugeshi", "Busasamana", "Cyanzarwe", "Gisenyi", "Kanama",
          "Kanzenze", "Mudende", "Nyakiliba", "Nyamyumba",
          "Nyundo", "Rubavu", "Rugerero",
        ],
      },
      {
        name: "Rusizi",
        sectors: [
          "Bugarama", "Butare", "Bweyeye", "Gashonga", "Giheke",
          "Gihundwe", "Gitambi", "Kamembe", "Muganza", "Mururu",
          "Nkungu", "Nyakabuye", "Nyakarenzo", "Nzahaha", "Rwimbogo",
        ],
      },
      {
        name: "Rutsiro",
        sectors: [
          "Boneza", "Gihango", "Kigeyo", "Kivumu", "Manihira",
          "Mukura", "Murunda", "Musasa", "Mushonyi", "Mushubati",
          "Nyabirasi", "Ruhango", "Rusebeya",
        ],
      },
    ],
  },
];

/** Get all province names */
export const getProvinces = (): string[] =>
  RWANDA_PROVINCES.map((p) => p.name);

/** Get districts for a given province name */
export const getDistricts = (provinceName: string): string[] => {
  const province = RWANDA_PROVINCES.find((p) => p.name === provinceName);
  return province ? province.districts.map((d) => d.name) : [];
};

/** Get sectors for a given province + district */
export const getSectors = (provinceName: string, districtName: string): string[] => {
  const province = RWANDA_PROVINCES.find((p) => p.name === provinceName);
  if (!province) return [];
  const district = province.districts.find((d) => d.name === districtName);
  return district ? district.sectors : [];
};

/** NISR Mapping Code -> Name Helpers */
export const PROVINCE_MAP: Record<string, string> = {
  "1": "Kigali City",
  "2": "Southern Province",
  "3": "Western Province",
  "4": "Northern Province",
  "5": "Eastern Province",
};

export const DISTRICT_MAP: Record<string, string> = {
  "101": "Nyarugenge", "102": "Gasabo", "103": "Kicukiro",
  "201": "Nyanza", "202": "Gisagara", "203": "Nyaruguru", "204": "Huye", 
  "205": "Nyamagabe", "206": "Ruhango", "207": "Muhanga", "208": "Kamonyi",
  "301": "Karongi", "302": "Rutsiro", "303": "Rubavu", "304": "Nyabihu", 
  "305": "Ngororero", "306": "Rusizi", "307": "Nyamasheke",
  "401": "Rulindo", "402": "Gakenke", "403": "Musanze", "404": "Burera", "405": "Gicumbi",
  "501": "Rwamagana", "502": "Nyagatare", "503": "Gatsibo", "504": "Kayonza", 
  "505": "Kirehe", "506": "Ngoma", "507": "Bugesera"
};

export const resolveProvinceName = (val?: string): string => val ? (PROVINCE_MAP[val] || val) : "";
export const resolveDistrictName = (val?: string): string => val ? (DISTRICT_MAP[val] || val) : "";
