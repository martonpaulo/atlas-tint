const splitAliases = (value = "") => value.split(";").filter(Boolean);

const worldRows = `
DZ|Algeria|Africa
AO|Angola|Africa
BJ|Benin|Africa
BW|Botswana|Africa
BF|Burkina Faso|Africa
BI|Burundi|Africa
CV|Cabo Verde|Africa|Cape Verde
CM|Cameroon|Africa
CF|Central African Republic|Africa
TD|Chad|Africa
KM|Comoros|Africa
CG|Republic of the Congo|Africa|Congo;Congo-Brazzaville
CD|Democratic Republic of the Congo|Africa|DR Congo;Congo-Kinshasa
CI|Côte d’Ivoire|Africa|Ivory Coast
DJ|Djibouti|Africa
EG|Egypt|Africa
GQ|Equatorial Guinea|Africa
ER|Eritrea|Africa
SZ|Eswatini|Africa|Swaziland
ET|Ethiopia|Africa
GA|Gabon|Africa
GM|The Gambia|Africa|Gambia
GH|Ghana|Africa
GN|Guinea|Africa
GW|Guinea-Bissau|Africa
KE|Kenya|Africa
LS|Lesotho|Africa
LR|Liberia|Africa
LY|Libya|Africa
MG|Madagascar|Africa
MW|Malawi|Africa
ML|Mali|Africa
MR|Mauritania|Africa
MU|Mauritius|Africa
MA|Morocco|Africa
MZ|Mozambique|Africa
NA|Namibia|Africa
NE|Niger|Africa
NG|Nigeria|Africa
RW|Rwanda|Africa
ST|São Tomé and Príncipe|Africa|Sao Tome and Principe
SN|Senegal|Africa
SC|Seychelles|Africa
SL|Sierra Leone|Africa
SO|Somalia|Africa
ZA|South Africa|Africa
SS|South Sudan|Africa
SD|Sudan|Africa
TZ|Tanzania|Africa|United Republic of Tanzania
TG|Togo|Africa
TN|Tunisia|Africa
UG|Uganda|Africa
ZM|Zambia|Africa
ZW|Zimbabwe|Africa
AF|Afghanistan|Asia
AM|Armenia|Asia
AZ|Azerbaijan|Asia
BH|Bahrain|Asia
BD|Bangladesh|Asia
BT|Bhutan|Asia
BN|Brunei|Asia|Brunei Darussalam
KH|Cambodia|Asia
CN|China|Asia|People’s Republic of China;PRC
CY|Cyprus|Asia
GE|Georgia|Asia
IN|India|Asia
ID|Indonesia|Asia
IR|Iran|Asia|Islamic Republic of Iran
IQ|Iraq|Asia
IL|Israel|Asia
JP|Japan|Asia
JO|Jordan|Asia
KZ|Kazakhstan|Asia
KW|Kuwait|Asia
KG|Kyrgyzstan|Asia
LA|Laos|Asia|Lao People’s Democratic Republic;Lao PDR
LB|Lebanon|Asia
MY|Malaysia|Asia
MV|Maldives|Asia
MN|Mongolia|Asia
MM|Myanmar|Asia|Burma
NP|Nepal|Asia
KP|North Korea|Asia|Democratic People’s Republic of Korea;DPRK
OM|Oman|Asia
PK|Pakistan|Asia
PS|State of Palestine|Asia|Palestine
PH|Philippines|Asia
QA|Qatar|Asia
SA|Saudi Arabia|Asia
SG|Singapore|Asia
KR|South Korea|Asia|Republic of Korea
LK|Sri Lanka|Asia
SY|Syria|Asia|Syrian Arab Republic
TJ|Tajikistan|Asia
TH|Thailand|Asia
TL|Timor-Leste|Asia|East Timor
TR|Türkiye|Asia|Turkey
TM|Turkmenistan|Asia
AE|United Arab Emirates|Asia|UAE
UZ|Uzbekistan|Asia
VN|Vietnam|Asia|Viet Nam
YE|Yemen|Asia
AL|Albania|Europe
AD|Andorra|Europe
AT|Austria|Europe
BY|Belarus|Europe
BE|Belgium|Europe
BA|Bosnia and Herzegovina|Europe
BG|Bulgaria|Europe
HR|Croatia|Europe
CZ|Czechia|Europe|Czech Republic
DK|Denmark|Europe
EE|Estonia|Europe
FI|Finland|Europe
FR|France|Europe
DE|Germany|Europe
GR|Greece|Europe
VA|Holy See|Europe|Vatican City;Vatican
HU|Hungary|Europe
IS|Iceland|Europe
IE|Ireland|Europe
IT|Italy|Europe
LV|Latvia|Europe
LI|Liechtenstein|Europe
LT|Lithuania|Europe
LU|Luxembourg|Europe
MT|Malta|Europe
MD|Moldova|Europe|Republic of Moldova
MC|Monaco|Europe
ME|Montenegro|Europe
NL|Netherlands|Europe|The Netherlands
MK|North Macedonia|Europe|Macedonia
NO|Norway|Europe
PL|Poland|Europe
PT|Portugal|Europe
RO|Romania|Europe
RU|Russia|Europe|Russian Federation
SM|San Marino|Europe
RS|Serbia|Europe
SK|Slovakia|Europe
SI|Slovenia|Europe
ES|Spain|Europe
SE|Sweden|Europe
CH|Switzerland|Europe
UA|Ukraine|Europe
GB|United Kingdom|Europe|UK;Great Britain
AG|Antigua and Barbuda|North America
BS|The Bahamas|North America|Bahamas
BB|Barbados|North America
BZ|Belize|North America
CA|Canada|North America
CR|Costa Rica|North America
CU|Cuba|North America
DM|Dominica|North America
DO|Dominican Republic|North America
SV|El Salvador|North America
GD|Grenada|North America
GT|Guatemala|North America
HT|Haiti|North America
HN|Honduras|North America
JM|Jamaica|North America
MX|Mexico|North America
NI|Nicaragua|North America
PA|Panama|North America
KN|Saint Kitts and Nevis|North America
LC|Saint Lucia|North America
VC|Saint Vincent and the Grenadines|North America
TT|Trinidad and Tobago|North America
US|United States|North America|United States of America;USA;US
AR|Argentina|South America
BO|Bolivia|South America|Plurinational State of Bolivia
BR|Brazil|South America|Brasil
CL|Chile|South America
CO|Colombia|South America
EC|Ecuador|South America
GY|Guyana|South America
PY|Paraguay|South America
PE|Peru|South America|Perú
SR|Suriname|South America
UY|Uruguay|South America
VE|Venezuela|South America|Bolivarian Republic of Venezuela
AU|Australia|Oceania
FJ|Fiji|Oceania
KI|Kiribati|Oceania
MH|Marshall Islands|Oceania
FM|Micronesia|Oceania|Federated States of Micronesia
NR|Nauru|Oceania
NZ|New Zealand|Oceania|Aotearoa
PW|Palau|Oceania
PG|Papua New Guinea|Oceania
WS|Samoa|Oceania
SB|Solomon Islands|Oceania
TO|Tonga|Oceania
TV|Tuvalu|Oceania
VU|Vanuatu|Oceania
`
	.trim()
	.split("\n");

const worldEntities = worldRows.map((row) => {
	const [code, name, groupId, aliases] = row.split("|");
	return {
		id: `world-${code.toLowerCase()}`,
		geometryId: code,
		name,
		localNames: [],
		aliases: splitAliases(aliases),
		codes: [code],
		groupId,
		groupName: groupId,
		groupAliases: [],
		selectable: true,
	};
});

const brazilRows = `
AC|Acre|north
AP|Amapá|north
AM|Amazonas|north
PA|Pará|north
RO|Rondônia|north
RR|Roraima|north
TO|Tocantins|north
AL|Alagoas|northeast
BA|Bahia|northeast
CE|Ceará|northeast
MA|Maranhão|northeast
PB|Paraíba|northeast
PE|Pernambuco|northeast
PI|Piauí|northeast
RN|Rio Grande do Norte|northeast
SE|Sergipe|northeast
DF|Distrito Federal|central-west|Federal District
GO|Goiás|central-west
MT|Mato Grosso|central-west
MS|Mato Grosso do Sul|central-west
ES|Espírito Santo|southeast
MG|Minas Gerais|southeast
RJ|Rio de Janeiro|southeast
SP|São Paulo|southeast
PR|Paraná|south
RS|Rio Grande do Sul|south
SC|Santa Catarina|south
`
	.trim()
	.split("\n");

const brazilParents = [
	["north", "North"],
	["northeast", "Northeast"],
	["central-west", "Central-West"],
	["southeast", "Southeast"],
	["south", "South"],
].map(([id, name]) => ({ id: `br-${id}`, name, aliases: [], childIds: [] }));

const brazilEntities = brazilRows.map((row) => {
	const [code, name, parentKey, aliases] = row.split("|");
	const parent = brazilParents.find(({ id }) => id === `br-${parentKey}`);
	if (!parent) throw new Error(`Unknown Brazil parent: ${parentKey}`);
	const id = `br-${code.toLowerCase()}`;
	parent.childIds.push(id);
	return {
		id,
		geometryId: code,
		name,
		localNames: [name],
		aliases: splitAliases(aliases),
		codes: [code],
		groupId: parent.id,
		groupName: parent.name,
		groupAliases: parent.aliases,
		selectable: true,
	};
});

const spainParentRows = [
	["andalusia", "Andalusia", "Andalucía"],
	["aragon", "Aragon", "Aragón"],
	["asturias", "Asturias", "Principality of Asturias;Principado de Asturias"],
	["balearic-islands", "Balearic Islands", "Illes Balears;Islas Baleares"],
	["basque-country", "Basque Country", "Euskadi;País Vasco"],
	["canary-islands", "Canary Islands", "Canarias;Islas Canarias"],
	["cantabria", "Cantabria", ""],
	["castile-and-leon", "Castile and León", "Castilla y León"],
	["castile-la-mancha", "Castilla–La Mancha", "Castilla-La Mancha"],
	["catalonia", "Catalonia", "Catalunya;Cataluña"],
	["extremadura", "Extremadura", ""],
	["galicia", "Galicia", "Galiza"],
	["la-rioja", "La Rioja", ""],
	["madrid", "Community of Madrid", "Comunidad de Madrid;Madrid"],
	["murcia", "Region of Murcia", "Región de Murcia;Murcia"],
	["navarre", "Navarre", "Nafarroa;Navarra"],
	[
		"valencian-community",
		"Valencian Community",
		"Comunitat Valenciana;Comunidad Valenciana",
	],
	["ceuta", "Ceuta", "Autonomous City of Ceuta;Ciudad Autónoma de Ceuta"],
	[
		"melilla",
		"Melilla",
		"Autonomous City of Melilla;Ciudad Autónoma de Melilla",
	],
];

const spainParents = spainParentRows.map(([key, name, aliases]) => ({
	id: `es-${key}`,
	name,
	aliases: splitAliases(aliases),
	childIds: [],
}));

const spainRows = `
01|Araba / Álava|basque-country|Araba;Álava
02|Albacete|castile-la-mancha
03|Alacant / Alicante|valencian-community|Alacant;Alicante
04|Almería|andalusia
05|Ávila|castile-and-leon
06|Badajoz|extremadura
07|Illes Balears|balearic-islands|Islas Baleares;Balearic Islands
08|Barcelona|catalonia
09|Burgos|castile-and-leon
10|Cáceres|extremadura
11|Cádiz|andalusia
12|Castelló / Castellón|valencian-community|Castelló;Castellón
13|Ciudad Real|castile-la-mancha
14|Córdoba|andalusia
15|A Coruña|galicia|La Coruña
16|Cuenca|castile-la-mancha
17|Girona|catalonia|Gerona
18|Granada|andalusia
19|Guadalajara|castile-la-mancha
20|Gipuzkoa|basque-country|Guipúzcoa
21|Huelva|andalusia
22|Huesca|aragon
23|Jaén|andalusia
24|León|castile-and-leon
25|Lleida|catalonia|Lérida
26|La Rioja|la-rioja
27|Lugo|galicia
28|Madrid|madrid
29|Málaga|andalusia
30|Murcia|murcia
31|Navarra / Nafarroa|navarre|Navarra;Nafarroa
32|Ourense|galicia|Orense
33|Asturias|asturias
34|Palencia|castile-and-leon
35|Las Palmas|canary-islands
36|Pontevedra|galicia
37|Salamanca|castile-and-leon
38|Santa Cruz de Tenerife|canary-islands|Tenerife
39|Cantabria|cantabria
40|Segovia|castile-and-leon
41|Sevilla|andalusia|Seville
42|Soria|castile-and-leon
43|Tarragona|catalonia
44|Teruel|aragon
45|Toledo|castile-la-mancha
46|València / Valencia|valencian-community|València;Valencia
47|Valladolid|castile-and-leon
48|Bizkaia|basque-country|Vizcaya
49|Zamora|castile-and-leon
50|Zaragoza|aragon
51|Ceuta|ceuta
52|Melilla|melilla
`
	.trim()
	.split("\n");

const spainInsets = new Map([
	["35", "canary"],
	["38", "canary"],
	["51", "ceuta"],
	["52", "melilla"],
]);

const spainEntities = spainRows.map((row) => {
	const [code, name, parentKey, aliases] = row.split("|");
	const parent = spainParents.find(({ id }) => id === `es-${parentKey}`);
	if (!parent) throw new Error(`Unknown Spain parent: ${parentKey}`);
	const id = `es-${code}`;
	parent.childIds.push(id);
	return {
		id,
		geometryId: code,
		name,
		localNames: splitAliases(aliases),
		aliases: splitAliases(aliases),
		codes: [code],
		groupId: parent.id,
		groupName: parent.name,
		groupAliases: parent.aliases,
		selectable: true,
		inset: spainInsets.get(code),
	};
});

export const manifests = {
	world: {
		id: "world",
		name: "World sovereign states",
		shortName: "World",
		description:
			"195 sovereign states: 193 UN members, the Holy See, and the State of Palestine.",
		primaryTotal: 195,
		defaultProjection: "equal-earth",
		projections: ["equal-earth", "natural-earth", "robinson", "mercator"],
		entities: worldEntities,
		parents: [],
	},
	brazil: {
		id: "brazil",
		name: "Brazilian federative units",
		shortName: "Brazil",
		description:
			"26 states and the Federal District, grouped by the five official geographic regions.",
		primaryTotal: 27,
		defaultProjection: "mercator",
		projections: ["mercator"],
		entities: brazilEntities,
		parents: brazilParents,
	},
	spain: {
		id: "spain",
		name: "Spanish provinces and autonomous cities",
		shortName: "Spain",
		description:
			"50 provinces plus Ceuta and Melilla, grouped by autonomous community or city.",
		primaryTotal: 52,
		defaultProjection: "mercator",
		projections: ["mercator"],
		entities: spainEntities,
		parents: spainParents,
	},
};
