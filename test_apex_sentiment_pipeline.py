#!/usr/bin/env python3
"""
Complete Sentiment Analysis Pipeline Test
==========================================
Tests the full pipeline for Apex West Midtown:
1. Fetch reviews from GBP API
2. Store reviews in database
3. Analyze sentiment with OpenAI
4. Store sentiment analysis
5. Generate sentiment report

This is the proof of concept for the PIB sentiment feature.
"""

import sys
import json
from pathlib import Path
from datetime import datetime

# Add Portfolio_Monitoring to path
sys.path.insert(0, str(Path(__file__).parent / "Portfolio_Monitoring"))

from src.collectors.gbp_collector import GoogleBusinessProfileCollector
from src.analyzers.sentiment_analyzer import ReviewSentimentAnalyzer
from src.db.database_manager import DatabaseManager

# Apex West Midtown configuration
PROPERTY_ID = "395265392"  # GA4 ID
PROPERTY_NAME = "Apex West Midtown"
GBP_ACCOUNT_ID = "107949533411154656301"
GBP_LOCATION_ID = "17062706106317913185"

# Paths
CREDS_PATH = Path("credentials/client_secret.json")
TOKEN_PATH = Path("credentials/gbp_token.pickle")


def print_section(title: str):
    """Print a section header."""
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)


def main():
    print_section("APEX WEST MIDTOWN - SENTIMENT ANALYSIS PIPELINE TEST")
    
    print(f"\nProperty: {PROPERTY_NAME}")
    print(f"GA4 ID: {PROPERTY_ID}")
    print(f"GBP Account: {GBP_ACCOUNT_ID}")
    print(f"GBP Location: {GBP_LOCATION_ID}")
    
    # =========================================================================
    # STEP 1: Initialize collectors and database
    # =========================================================================
    print_section("STEP 1: Initialize Systems")
    
    print("\n📊 Initializing database...")
    db = DatabaseManager()
    print("✅ Database ready")
    
    print("\n🔐 Initializing GBP collector...")
    gbp = GoogleBusinessProfileCollector(CREDS_PATH, TOKEN_PATH)
    print("✅ GBP collector ready")
    
    print("\n🤖 Initializing sentiment analyzer...")
    try:
        analyzer = ReviewSentimentAnalyzer()
        print("✅ Sentiment analyzer ready")
        has_analyzer = True
    except ValueError as e:
        print(f"⚠️  Sentiment analyzer not available: {e}")
        print("   Continuing with review collection only...")
        analyzer = None
        has_analyzer = False
    
    # =========================================================================
    # STEP 2: Fetch reviews
    # =========================================================================
    print_section("STEP 2: Fetch Reviews from Google Business Profile")
    
    print(f"\n📥 Fetching reviews for Apex West...")
    raw_reviews = gbp.fetch_reviews(
        account_id=GBP_ACCOUNT_ID,
        location_id=GBP_LOCATION_ID,
        page_size=50,  # Get last 50 reviews
        order_by="updateTime desc"
    )
    
    print(f"✅ Fetched {len(raw_reviews)} reviews")
    
    if len(raw_reviews) == 0:
        print("❌ No reviews found. Exiting.")
        return
    
    # Parse reviews
    print("\n📝 Parsing reviews...")
    parsed_reviews = [gbp.parse_review(r) for r in raw_reviews]
    
    # Show sample
    print("\n📋 Sample review:")
    sample = parsed_reviews[0]
    print(f"  Rating: {sample['star_rating_numeric']}/5")
    print(f"  Date: {sample['review_create_time']}")
    print(f"  Reviewer: {sample['reviewer_display_name']}")
    if sample['comment']:
        comment_preview = sample['comment'][:100] + "..." if len(sample['comment']) > 100 else sample['comment']
        print(f"  Comment: {comment_preview}")
    
    # =========================================================================
    # STEP 3: Store reviews in database
    # =========================================================================
    print_section("STEP 3: Store Reviews in Database")
    
    print(f"\n💾 Storing {len(parsed_reviews)} reviews...")
    inserted = db.insert_gbp_reviews_batch(
        reviews=parsed_reviews,
        property_id=PROPERTY_ID,
        gbp_location_id=GBP_LOCATION_ID
    )
    print(f"✅ Stored {inserted} reviews")
    
    # =========================================================================
    # STEP 4: Analyze sentiment (limited batch for testing)
    # =========================================================================
    sentiment_results = []
    reviews_to_analyze = []
    
    if has_analyzer:
        print_section("STEP 4: Analyze Sentiment with OpenAI")
        
        # Get reviews with comments (limit to 10 for testing to save API costs)
        reviews_to_analyze = [r for r in parsed_reviews if r.get('comment')][:10]
        
        print(f"\n🤖 Analyzing sentiment for {len(reviews_to_analyze)} reviews...")
        print(f"   (Limited to 10 for cost control in POC)")
        
        sentiment_results = analyzer.analyze_reviews_batch(reviews_to_analyze)
        
        print(f"✅ Analysis complete")
    else:
        print_section("STEP 4: Analyze Sentiment - SKIPPED")
        print("\n⚠️  Sentiment analysis skipped (no OpenAI API key)")
        print("   Set OPENAI_API_KEY environment variable to enable")
    
    # Show sample sentiment
    print("\n📊 Sample sentiment analysis:")
    for i, (review, sentiment) in enumerate(zip(reviews_to_analyze[:3], sentiment_results[:3])):
        print(f"\n  Review {i+1}:")
        print(f"    Rating: {review['star_rating_numeric']}/5")
        print(f"    Sentiment: {sentiment['sentiment_label']} (score: {sentiment['sentiment_score']:.2f})")
        print(f"    Emotion: {sentiment['emotion']}")
        themes = [k.replace('theme_', '') for k, v in sentiment.items() 
                 if k.startswith('theme_') and v]
        if themes:
            print(f"    Themes: {', '.join(themes)}")
        if sentiment.get('requires_attention'):
            print(f"    ⚠️  Requires attention")
    
    # =========================================================================
    # STEP 5: Store sentiment analysis
    # =========================================================================
    if has_analyzer and sentiment_results:
        print_section("STEP 5: Store Sentiment Analysis in Database")
        
        print(f"\n💾 Storing sentiment analysis...")
        for review, sentiment in zip(reviews_to_analyze, sentiment_results):
            # Convert key_phrases list to JSON string if needed
            if isinstance(sentiment.get('key_phrases'), list):
                sentiment['key_phrases'] = json.dumps(sentiment['key_phrases'])
            
            db.insert_review_sentiment(
                review_id=review['review_id'],
                property_id=PROPERTY_ID,
                sentiment_data=sentiment
            )
        
        print(f"✅ Stored {len(sentiment_results)} sentiment analyses")
    else:
        print_section("STEP 5: Store Sentiment Analysis - SKIPPED")
        print("\n⚠️  No sentiment data to store")
    
    # =========================================================================
    # STEP 6: Generate sentiment report
    # =========================================================================
    print_section("STEP 6: Generate Sentiment Report")
    
    # Query reviews with sentiment
    print("\n📊 Querying reviews with sentiment...")
    reviews_with_sentiment = db.get_reviews_with_sentiment(
        property_id=PROPERTY_ID,
        days=90
    )
    
    print(f"✅ Found {len(reviews_with_sentiment)} reviews with sentiment (last 90 days)")
    
    # Generate report
    print("\n" + "=" * 80)
    print(f"  SENTIMENT REPORT - {PROPERTY_NAME}")
    print("=" * 80)
    
    # Overall stats
    total_reviews = len([r for r in parsed_reviews if r.get('comment')])
    analyzed_reviews = [r for r in reviews_with_sentiment if r.get('sentiment_label')]
    
    if analyzed_reviews:
        avg_sentiment = sum(r['sentiment_score'] for r in analyzed_reviews) / len(analyzed_reviews)
        
        positive = len([r for r in analyzed_reviews if r['sentiment_label'] == 'positive'])
        neutral = len([r for r in analyzed_reviews if r['sentiment_label'] == 'neutral'])
        negative = len([r for r in analyzed_reviews if r['sentiment_label'] == 'negative'])
        
        print(f"\n📈 Overall Sentiment")
        print(f"   Total Reviews: {total_reviews}")
        print(f"   Analyzed: {len(analyzed_reviews)}")
        print(f"   Average Sentiment Score: {avg_sentiment:.2f}")
        print(f"   Distribution: {positive} positive, {neutral} neutral, {negative} negative")
        
        # Theme analysis
        print(f"\n🏷️  Theme Analysis")
        themes = ['maintenance', 'staff', 'amenities', 'noise', 'location', 
                 'value', 'move_in', 'move_out', 'pets', 'parking']
        
        for theme in themes:
            theme_key = f'theme_{theme}'
            count = len([r for r in analyzed_reviews if r.get(theme_key)])
            if count > 0:
                avg_score = sum(r['sentiment_score'] for r in analyzed_reviews 
                              if r.get(theme_key)) / count
                print(f"   {theme.capitalize():12} : {count:2} mentions (avg: {avg_score:+.2f})")
        
        # Critical reviews
        critical = [r for r in analyzed_reviews if r.get('requires_attention')]
        if critical:
            print(f"\n⚠️  Reviews Requiring Attention: {len(critical)}")
            for r in critical[:3]:  # Show top 3
                print(f"   - {r['star_rating_numeric']}⭐ from {r['reviewer_display_name']}")
                if r.get('action_items'):
                    print(f"     Action: {r['action_items'][:80]}...")
    else:
        print("\n⚠️  No sentiment analysis data available yet")
    
    # =========================================================================
    # Summary
    # =========================================================================
    print_section("PIPELINE TEST COMPLETE")
    
    print(f"\n✅ Successfully tested complete sentiment analysis pipeline!")
    print(f"\nResults:")
    print(f"  • Fetched: {len(raw_reviews)} reviews")
    print(f"  • Stored: {inserted} reviews")
    print(f"  • Analyzed: {len(sentiment_results)} reviews")
    print(f"  • Total cost: ${sum(s.get('analysis_cost_usd', 0) for s in sentiment_results):.4f}")
    
    print(f"\n🎯 Next steps:")
    print(f"  1. Create sentiment report generator module")
    print(f"  2. Integrate into Property Intelligence Brief")
    print(f"  3. Set up automated review collection")
    print(f"  4. Add sentiment trend tracking")


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n❌ Interrupted by user")
    except Exception as e:
        print(f"\n\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
