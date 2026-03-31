import csv
import json

from const import INPUT_CSV, OUTPUT_JSON, TOP_N


def prepare_data():
    """
    """
    settlements = []

    with open(INPUT_CSV, 'r', encoding='utf-8') as csv_file:
        csv_reader = csv.DictReader(csv_file, delimiter=';')

        for row in csv_reader:

            first_key = list(row.keys())[0]
            
            if row.get(first_key) != 'Населенный пункт':
                continue

            pop_str = row.get('population', 0)

            if not pop_str or pop_str == '0':
                continue

            try:
                population = int(pop_str.replace(" ", ""))
            except:
                population = 0

            lat_str = row.get('latitude_dadata', '0')
            lon_str = row.get('longitude_dadata', '0')

            if not lat_str or not lon_str:
                continue

            try:
                lat = float(lat_str)
                lon = float(lon_str)
            except:
                continue

            settlements.append({
                'locality': row.get('settlement', 'Неизвестно'),
                'lat': lat,
                'lon': lon,
                'population': population
            })

    settlements.sort(key=lambda x: x['population'], reverse=True)

    top_settlements = settlements[:TOP_N]
        
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as json_file:
        json.dump(top_settlements, json_file, ensure_ascii=False, indent=2)

    print(f"Обработано записей: {len(settlements)}")
    print(f"Сохранено топ-{TOP_N} населённых пунктов в {OUTPUT_JSON}")
            
