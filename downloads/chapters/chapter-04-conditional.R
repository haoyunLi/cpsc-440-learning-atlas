# CPSC 440 Learning Atlas: standalone teaching example
# Chapter 04, section: conditional
# Run in a fresh R session; no external packages or data files are needed.
# Read the lesson for assumptions, data provenance, and interpretation.

# Original teaching data: rows are fraud status, columns are policy types.
claims <- matrix(c(18,12,10,42,88,30),nrow=2,byrow=TRUE,
                 dimnames=list(status=c("fraud","nonfraud"),
                               policy=c("fire","auto","theft")))
stopifnot(all(claims>=0),all(claims==floor(claims)))
n <- sum(claims)
fraud_n <- sum(claims["fraud",])
fire_n <- sum(claims[,"fire"])
intersection_n <- claims["fraud","fire"]
print(addmargins(claims))
# Return NA, not zero, when the conditioning event has no records.
safe_ratio <- function(numerator,denominator) {
  if (denominator==0) return(NA_real_)
  numerator/denominator
}
p_fraud <- safe_ratio(fraud_n,n)
p_fire <- safe_ratio(fire_n,n)
p_joint <- safe_ratio(intersection_n,n)
p_fraud_given_fire <- safe_ratio(intersection_n,fire_n)
p_fire_given_fraud <- safe_ratio(intersection_n,fraud_n)
product <- p_fraud*p_fire
print(c(n=n,fraud_n=fraud_n,fire_n=fire_n,joint=p_joint,
        fraud=p_fraud,fire=p_fire,
        fraud_given_fire=p_fraud_given_fire,
        fire_given_fraud=p_fire_given_fraud,
        product_of_marginals=product))
# This equality describes the table, not a population significance test.
empirical_independence <- isTRUE(all.equal(p_joint,product))
print(list(empirical_independence=empirical_independence,
           zero_condition=safe_ratio(0,0)))
stopifnot(n==200,fraud_n==40,fire_n==60,
          abs(p_joint-.09)<1e-12,
          abs(p_fraud_given_fire-.30)<1e-12,
          abs(p_fire_given_fraud-.45)<1e-12,
          abs(product-.06)<1e-12,
          !empirical_independence,is.na(safe_ratio(0,0)))
